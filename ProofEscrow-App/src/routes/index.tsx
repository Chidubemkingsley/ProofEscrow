import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { useApp, fmtUsdc, type Currency } from "@/lib/store";
import { TRADE_LIMITS } from "@/routes/create-offer";
import { ShieldCheck, Lock, ArrowRight, Star, Zap, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { offers, walletAddress, rates, ratesLoading, fetchRates, startTrade } = useApp();
  const [currency, setCurrency] = useState<Currency>("NGN");
  const navigate = useNavigate();

  // Fetch live rates on mount
  useEffect(() => { fetchRates(); }, []);

  const filtered = useMemo(() => offers.filter((o) => o.currency === currency && o.available > 0).sort((a, b) => a.pricePerUsdc - b.pricePerUsdc), [offers, currency]);

  const totalLocked = useMemo(() => offers.reduce((s, o) => s + o.available, 0), [offers]);

  const handleBuy = (offerId: string, amount: number) => {
    if (!walletAddress) {
      toast.error("Connect a wallet to start a trade");
      return;
    }
    const trade = startTrade(offerId, amount);
    if (trade) {
      toast.success("Trade opened — escrow funded by seller");
      navigate({ to: "/trade/$id", params: { id: trade.id } });
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-10">
        {/* Hero band */}
        <section className="mb-10 grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 p-6 md:p-8 rounded-2xl bg-card border border-border relative overflow-hidden">
            <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
            <div className="relative">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase mb-4 ring-1 ring-primary/20">
                <Lock className="size-3" /> On-Chain Escrow · Stellar Soroban
              </div>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tighter mb-3">
                Trade USDC for <span className="text-primary">local fiat</span>.
                <br />
                Without trusting anyone.
              </h1>
              <p className="text-muted-foreground max-w-xl text-sm md:text-base">
                Settla never holds your funds. Every trade is locked in a Soroban smart contract — neither the seller, the buyer, nor the platform can move it without proof.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link to="/create-offer" className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition shadow-[0_0_24px_rgba(16,185,129,0.3)] inline-flex items-center gap-2">
                  Create a sell offer <ArrowRight className="size-4" />
                </Link>
                <a href="#listings" className="px-5 py-2.5 rounded-lg bg-secondary text-foreground text-sm font-semibold border border-border hover:border-primary/40 transition">Browse marketplace</a>
              </div>
            </div>
          </div>
        <div className="grid grid-cols-1 gap-4">
            <Stat label="Locked in escrow" value={fmtUsdc(totalLocked)} accent />
            <Stat label="Live NGN rate" value={`${rates.NGN.toLocaleString()} NGN`} sub="per USDC · live" />
            <Stat label="Active offers" value={`${offers.filter(o => !o.id.startsWith('demo-')).length} real · ${offers.filter(o => o.id.startsWith('demo-')).length} demo`} sub="across NGN · GHS · KES" />
          </div>
        </section>

        {/* Listings */}
        <section id="listings" className="grid lg:grid-cols-12 gap-8">
          <div className="lg:col-span-12">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">Active sell offers</h2>
                <p className="text-xs text-muted-foreground font-mono uppercase tracking-tighter mt-1">Lowest price first · settle on-chain in seconds</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex p-1 rounded-lg bg-card border border-border">
                  {(["NGN", "GHS", "KES"] as Currency[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={`px-4 py-1.5 rounded-md text-xs font-semibold transition ${currency === c ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <button
                  onClick={fetchRates}
                  disabled={ratesLoading}
                  className="p-2 rounded-lg border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition"
                  title="Refresh live rates"
                >
                  <RefreshCw className={`size-3.5 ${ratesLoading ? "animate-spin" : ""}`} />
                </button>
                <span className="text-[10px] font-mono text-muted-foreground hidden sm:block">
                  1 USDC = {rates[currency].toLocaleString()} {currency}
                </span>
              </div>
            </div>

            {/* Header row (desktop) */}
            <div className="hidden md:grid grid-cols-12 px-5 py-2 text-[10px] font-mono uppercase text-muted-foreground tracking-wider border-b border-border">
              <div className="col-span-4">Seller</div>
              <div className="col-span-2 text-right">Price</div>
              <div className="col-span-2 text-right">Available</div>
              <div className="col-span-2 text-right">Limits</div>
              <div className="col-span-2 text-right">Action</div>
            </div>

            <div className="divide-y divide-border border-b border-border">
              {filtered.map((o) => (
                <OfferRow key={o.id} offer={o} onBuy={handleBuy} currency={currency} />
              ))}
              {filtered.length === 0 && (
                <div className="py-16 text-center text-muted-foreground text-sm">No active offers in {currency} right now. Be the first to list.</div>
              )}
            </div>
          </div>
        </section>

        {/* Trust footer */}
        <section className="mt-16 grid md:grid-cols-3 gap-4">
          <TrustCard icon={<Lock className="size-5" />} title="Non-custodial" body="USDC sits in a Soroban contract. Settla has no withdrawal key. No platform freeze, no seizure." />
          <TrustCard icon={<ShieldCheck className="size-5" />} title="Immutable evidence" body="Bank receipts are pinned to the milestone. The arbiter sees the same proof you do." />
          <TrustCard icon={<Zap className="size-5" />} title="Trustless payouts" body="One signature releases funds. No middleman, no manual wire — code enforces the trade." />
        </section>
      </main>

      <footer className="border-t border-border mt-16 py-8 px-4 md:px-8 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Settla · Built on Stellar · Trustless Work
      </footer>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="p-5 rounded-2xl bg-card border border-border">
      <p className="text-[11px] font-mono uppercase tracking-tighter text-muted-foreground mb-1">{label}</p>
      <p className={`text-xl font-bold tracking-tight ${accent ? "text-primary" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70 font-mono uppercase mt-1">{sub}</p>}
    </div>
  );
}

function TrustCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="p-5 rounded-2xl bg-card border border-border">
      <div className="size-9 rounded-lg bg-primary/10 text-primary grid place-items-center mb-3 ring-1 ring-primary/20">{icon}</div>
      <h3 className="font-semibold text-sm mb-1">{title}</h3>
      <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function OfferRow({ offer, onBuy, currency }: { offer: ReturnType<typeof useApp.getState>["offers"][number]; onBuy: (id: string, amt: number) => void; currency: Currency }) {
  const [open, setOpen] = useState(false);
  const [amt, setAmt] = useState(offer.minLimit);
  return (
    <div className="md:grid md:grid-cols-12 px-3 md:px-5 py-4 items-center hover:bg-card/40 transition-colors group">
      <div className="md:col-span-4 flex items-center gap-3">
        <div className="size-9 rounded-full bg-secondary ring-1 ring-border grid place-items-center text-[11px] font-bold text-primary">
          {offer.sellerName.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="text-sm font-semibold text-foreground flex items-center gap-2">
            {offer.sellerName}
            {offer.verified && (
              <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[9px] font-bold tracking-widest">VERIFIED</span>
            )}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-2 mt-0.5">
            <Star className="size-2.5 fill-primary text-primary" /> {offer.rating.toFixed(2)} · {offer.trades.toLocaleString()} trades · {offer.bank}
          </div>
        </div>
      </div>
      <div className="md:col-span-2 text-left md:text-right mt-3 md:mt-0">
        <div className="text-sm font-mono font-bold text-primary">{offer.pricePerUsdc.toLocaleString()}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{currency} / USDC</div>
      </div>
      <div className="md:col-span-2 text-left md:text-right text-xs text-muted-foreground mt-2 md:mt-0">
        <span className="font-mono text-foreground">{offer.available.toLocaleString()}</span>
        <div className="text-[10px] font-mono">USDC</div>
      </div>
      <div className="md:col-span-2 text-left md:text-right text-xs text-muted-foreground mt-2 md:mt-0">
        <div className="font-mono">{offer.minLimit}–{offer.maxLimit.toLocaleString()}</div>
        <div className="text-[10px] font-mono">{offer.paymentSpeed}</div>
      </div>
      <div className="md:col-span-2 md:text-right mt-3 md:mt-0">
        <button
          onClick={() => setOpen((v) => !v)}
          className="px-5 py-2 bg-secondary border border-border group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary rounded-lg text-xs font-bold uppercase tracking-wider transition"
        >
          Buy USDC
        </button>
      </div>

      {open && (
        <div className="md:col-span-12 mt-4 p-4 rounded-xl bg-background/60 border border-border">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-[10px] font-mono uppercase tracking-tighter text-muted-foreground mb-1.5">
                Amount (USDC) · min {offer.minLimit} · max {offer.maxLimit.toLocaleString()}
              </label>
              <input
                type="number"
                value={amt}
                min={offer.minLimit}
                max={Math.min(offer.maxLimit, offer.available, TRADE_LIMITS.MAX_USDC)}
                onChange={(e) => setAmt(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary"
              />
              {amt >= TRADE_LIMITS.LARGE_TRADE && (
                <p className="text-[10px] text-yellow-500 font-mono mt-1">
                  ⚠ Large trade — ensure your bank can receive {(amt * offer.pricePerUsdc).toLocaleString()} {currency} in one transfer
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase tracking-tighter text-muted-foreground">You pay</div>
              <div className="text-lg font-bold font-mono text-primary">{(amt * offer.pricePerUsdc).toLocaleString()} <span className="text-xs text-muted-foreground">{currency}</span></div>
            </div>
            <button
              onClick={() => onBuy(offer.id, amt)}
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:opacity-90 transition shadow-[0_0_20px_rgba(16,185,129,0.3)]"
            >
              Open Trade
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
