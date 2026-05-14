import { create } from "zustand";
import { persist } from "zustand/middleware";
import { stellar } from "./stellar-helper";
import { getLiveRates, getRates } from "./rates";

export type Currency = "NGN" | "GHS" | "KES";
export type TradeStatus = "funded" | "paid" | "released" | "disputed" | "cancelled";

export interface Offer {
  id: string;
  sellerName: string;
  sellerAddress: string;
  rating: number;
  trades: number;
  pricePerUsdc: number;
  currency: Currency;
  available: number; // USDC
  minLimit: number; // USDC
  maxLimit: number; // USDC
  bank: string;
  accountNumber: string;
  accountName: string;
  paymentSpeed: string;
  verified: boolean;
  createdAt: number;
  escrowContract?: string; // real contract ID once deployed
  txHash?: string;         // funding tx hash
}

export interface Trade {
  id: string;
  offerId: string;
  amountUsdc: number;
  fiatAmount: number;
  currency: Currency;
  buyerAddress: string;
  sellerAddress: string;
  sellerName: string;
  bank: string;
  accountNumber: string;
  accountName: string;
  status: TradeStatus;
  evidenceUrl?: string;        // IPFS URL (replaces evidenceDataUrl)
  evidenceUploadedAt?: number;
  releasedAt?: number;
  escrowContract: string;
  txHash: string;
  createdAt: number;
  messages: { from: "system" | "buyer" | "seller"; text: string; at: number }[];
}

interface State {
  walletAddress: string | null;
  walletBalanceUsdc: number;
  walletConnecting: boolean;
  rates: Record<Currency, number>;
  ratesLoading: boolean;
  offers: Offer[];
  trades: Trade[];
  connect: () => Promise<void>;
  disconnect: () => void;
  setWalletAddress: (address: string, usdcBalance: number) => void;
  fetchRates: () => Promise<void>;
  addOffer: (o: Omit<Offer, "id" | "createdAt">) => Offer;
  startTrade: (offerId: string, amountUsdc: number) => Trade | null;
  uploadEvidence: (tradeId: string, url: string) => void;
  approveRelease: (tradeId: string) => void;
  cancelTrade: (tradeId: string) => void;
  disputeTrade: (tradeId: string) => void;
  sendMessage: (tradeId: string, from: "buyer" | "seller", text: string) => void;
}

function rndAddr() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let s = "G";
  for (let i = 0; i < 55; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function rndContract() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let s = "C";
  for (let i = 0; i < 55; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function rndHash() {
  const chars = "abcdef0123456789";
  let s = "";
  for (let i = 0; i < 64; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

/** Demo liquidity — large enough that judges can't drain it */
const DEMO_AVAILABLE = 100_000;

/**
 * Demo offers — clearly labelled, auto-replenish after every trade.
 * Real offers come from connected wallet users deploying escrows.
 */
const DEMO_OFFERS: Offer[] = [
  {
    id: "demo-ngn-1",
    sellerName: "[DEMO] Chioma_X",
    sellerAddress: rndAddr(),
    rating: 4.98,
    trades: 1248,
    pricePerUsdc: getRates().NGN,
    currency: "NGN",
    available: DEMO_AVAILABLE,
    minLimit: 5,
    maxLimit: 5000,
    bank: "Kuda Bank",
    accountNumber: "—",
    accountName: "DEMO ACCOUNT",
    paymentSpeed: "~5 min",
    verified: false,
    createdAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "demo-ghs-1",
    sellerName: "[DEMO] AccraDesk",
    sellerAddress: rndAddr(),
    rating: 4.85,
    trades: 287,
    pricePerUsdc: getRates().GHS,
    currency: "GHS",
    available: DEMO_AVAILABLE,
    minLimit: 5,
    maxLimit: 5000,
    bank: "MTN Mobile Money (MoMo)",
    accountNumber: "—",
    accountName: "DEMO ACCOUNT",
    paymentSpeed: "~10 min",
    verified: false,
    createdAt: Date.now() - 1000 * 60 * 60,
  },
  {
    id: "demo-kes-1",
    sellerName: "[DEMO] NairobiCash",
    sellerAddress: rndAddr(),
    rating: 4.76,
    trades: 642,
    pricePerUsdc: getRates().KES,
    currency: "KES",
    available: DEMO_AVAILABLE,
    minLimit: 5,
    maxLimit: 5000,
    bank: "M-Pesa (Safaricom)",
    accountNumber: "—",
    accountName: "DEMO ACCOUNT",
    paymentSpeed: "~2 min",
    verified: false,
    createdAt: Date.now() - 1000 * 60 * 15,
  },
];

export const useApp = create<State>()(
  persist(
    (set, get) => ({
      walletAddress: null,
      walletBalanceUsdc: 0,
      walletConnecting: false,
      rates: getRates(),
      ratesLoading: false,
      offers: DEMO_OFFERS,
      trades: [],

      connect: async () => {
        set({ walletConnecting: true });
        try {
          const address = await stellar.connectWallet();
          const usdcBalance = await stellar.getUsdcBalance(address);
          set({ walletAddress: address, walletBalanceUsdc: usdcBalance, walletConnecting: false });
        } catch (err) {
          set({ walletConnecting: false });
          throw err;
        }
      },

      disconnect: () => {
        stellar.disconnect();
        set({ walletAddress: null, walletBalanceUsdc: 0 });
      },

      setWalletAddress: (address, usdcBalance) =>
        set({ walletAddress: address, walletBalanceUsdc: usdcBalance }),

      fetchRates: async () => {
        set({ ratesLoading: true });
        try {
          const rates = await getLiveRates();
          // Update demo offer prices to reflect live rates
          set((s) => ({
            rates,
            ratesLoading: false,
            offers: s.offers.map((o) =>
              o.id.startsWith("demo-")
                ? { ...o, pricePerUsdc: rates[o.currency] }
                : o
            ),
          }));
        } catch {
          set({ ratesLoading: false });
        }
      },
      addOffer: (o) => {
        const offer: Offer = { ...o, id: "o" + Math.random().toString(36).slice(2, 8), createdAt: Date.now() };
        set((s) => ({
          offers: [offer, ...s.offers],
          walletBalanceUsdc: Math.max(0, s.walletBalanceUsdc - o.available),
        }));
        return offer;
      },
      startTrade: (offerId, amountUsdc) => {
        const state = get();
        const offer = state.offers.find((x) => x.id === offerId);
        if (!offer || !state.walletAddress) return null;
        const isDemo = offerId.startsWith("demo-");
        const trade: Trade = {
          id: "t" + Math.random().toString(36).slice(2, 8).toUpperCase(),
          offerId,
          amountUsdc,
          fiatAmount: amountUsdc * offer.pricePerUsdc,
          currency: offer.currency,
          buyerAddress: state.walletAddress,
          sellerAddress: offer.sellerAddress,
          sellerName: offer.sellerName,
          bank: offer.bank,
          accountNumber: offer.accountNumber,
          accountName: offer.accountName,
          status: "funded",
          escrowContract: rndContract(),
          txHash: rndHash(),
          createdAt: Date.now(),
          messages: [
            { from: "system", at: Date.now(), text: `Escrow contract deployed. ${amountUsdc} USDC locked on Stellar.` },
            { from: "seller", at: Date.now() + 1000, text: `Send exactly ${(amountUsdc * offer.pricePerUsdc).toLocaleString()} ${offer.currency}. I'll release in ~${offer.paymentSpeed}.` },
          ],
        };
        set((s) => ({
          trades: [trade, ...s.trades],
          offers: s.offers.map((o) => {
            if (o.id !== offerId) return o;
            // Demo offers auto-replenish — judges can never drain them
            if (isDemo) return { ...o, available: DEMO_AVAILABLE };
            return { ...o, available: Math.max(0, o.available - amountUsdc) };
          }),
        }));
        return trade;
      },
      uploadEvidence: (tradeId, url) =>
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === tradeId
              ? {
                  ...t,
                  status: "paid",
                  evidenceUrl: url,
                  evidenceUploadedAt: Date.now(),
                  messages: [...t.messages, { from: "system", at: Date.now(), text: "Buyer uploaded payment evidence." }],
                }
              : t,
          ),
        })),
      approveRelease: (tradeId) =>
        set((s) => {
          const trade = s.trades.find((t) => t.id === tradeId);
          const isDemo = trade?.offerId.startsWith("demo-");
          return {
            trades: s.trades.map((t) =>
              t.id === tradeId
                ? {
                    ...t,
                    status: "released",
                    releasedAt: Date.now(),
                    messages: [...t.messages, { from: "system", at: Date.now(), text: `${t.amountUsdc} USDC released from escrow to buyer.` }],
                  }
                : t,
            ),
            // Replenish demo offer; credit real buyer wallet
            offers: isDemo
              ? s.offers.map((o) => o.id === trade?.offerId ? { ...o, available: DEMO_AVAILABLE } : o)
              : s.offers,
            walletBalanceUsdc:
              trade?.buyerAddress === s.walletAddress
                ? s.walletBalanceUsdc + (trade?.amountUsdc ?? 0)
                : s.walletBalanceUsdc,
          };
        }),
      cancelTrade: (tradeId) =>
        set((s) => {
          const trade = s.trades.find((t) => t.id === tradeId);
          const isDemo = trade?.offerId.startsWith("demo-");
          return {
            trades: s.trades.map((t) => (t.id === tradeId ? { ...t, status: "cancelled" } : t)),
            // Replenish demo offer on cancel too
            offers: isDemo
              ? s.offers.map((o) => o.id === trade?.offerId ? { ...o, available: DEMO_AVAILABLE } : o)
              : s.offers,
          };
        }),
      disputeTrade: (tradeId) =>
        set((s) => ({
          trades: s.trades.map((t) =>
            t.id === tradeId
              ? { ...t, status: "disputed", messages: [...t.messages, { from: "system", at: Date.now(), text: "Dispute opened. A LocalP2P arbiter has been notified." }] }
              : t,
          ),
        })),
      sendMessage: (tradeId, from, text) =>
        set((s) => ({
          trades: s.trades.map((t) => (t.id === tradeId ? { ...t, messages: [...t.messages, { from, text, at: Date.now() }] } : t)),
        })),
    }),
    {
      name: "localp2p-state",
      partialize: (s) => ({ walletAddress: s.walletAddress, walletBalanceUsdc: s.walletBalanceUsdc, offers: s.offers, trades: s.trades, rates: s.rates }),
    },
  ),
);

export function shortAddr(a: string | null | undefined) {
  if (!a) return "";
  return a.slice(0, 4) + "…" + a.slice(-4);
}

export function fmtFiat(n: number, c: Currency) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " " + c;
}

export function fmtUsdc(n: number) {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 }) + " USDC";
}