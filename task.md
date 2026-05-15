# Settla — Implementation Task List

## Stack & Runtime
- **Framework:** TanStack Start (Vite + React 19)
- **Styling:** Tailwind CSS v4
- **State:** Zustand (persist middleware)
- **Routing:** TanStack Router (file-based)
- **Stellar:** `@stellar/stellar-sdk` + `@creit.tech/stellar-wallets-kit`
- **Escrow:** Trustless Work REST API
- **Realtime:** Pusher
- **Evidence Storage:** Pinata IPFS
- **Network:** Stellar Testnet · USDC

---

## Task 1 — Stellar Wallet Integration

Replace the mock `rndAddr()` connect with real wallet connection using `@creit.tech/stellar-wallets-kit`.

### 1.1 Install dependencies
```bash
bun add @stellar/stellar-sdk @creit.tech/stellar-wallets-kit react-icons
```

### 1.2 Create `src/lib/stellar-helper.ts`
Implement the `StellarHelper` class as provided:

```ts
import * as StellarSdk from '@stellar/stellar-sdk';
import {
  StellarWalletsKit,
  WalletNetwork,
  allowAllModules,
  FREIGHTER_ID,
} from '@creit.tech/stellar-wallets-kit';

export class StellarHelper {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;
  private kit: StellarWalletsKit;
  private network: WalletNetwork;
  private publicKey: string | null = null;

  constructor(network: 'testnet' | 'mainnet' = 'testnet') {
    this.server = new StellarSdk.Horizon.Server(
      network === 'testnet'
        ? 'https://horizon-testnet.stellar.org'
        : 'https://horizon.stellar.org'
    );
    this.networkPassphrase =
      network === 'testnet' ? StellarSdk.Networks.TESTNET : StellarSdk.Networks.PUBLIC;
    this.network = network === 'testnet' ? WalletNetwork.TESTNET : WalletNetwork.PUBLIC;

    this.kit = new StellarWalletsKit({
      network: this.network,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });
  }

  isFreighterInstalled(): boolean { return true; }

  async connectWallet(): Promise<string> {
    await this.kit.openModal({
      onWalletSelected: async (option) => {
        this.kit.setWallet(option.id);
      },
    });
    const { address } = await this.kit.getAddress();
    if (!address) throw new Error('No address returned from wallet');
    this.publicKey = address;
    return address;
  }

  async getBalance(publicKey: string): Promise<{
    xlm: string;
    assets: Array<{ code: string; issuer: string; balance: string }>;
  }> {
    const account = await this.server.loadAccount(publicKey);
    const xlmBalance = account.balances.find((b) => b.asset_type === 'native');
    const assets = account.balances
      .filter((b) => b.asset_type !== 'native')
      .map((b: any) => ({ code: b.asset_code, issuer: b.asset_issuer, balance: b.balance }));
    return {
      xlm: xlmBalance && 'balance' in xlmBalance ? xlmBalance.balance : '0',
      assets,
    };
  }

  async signTransaction(xdr: string): Promise<string> {
    const { signedTxXdr } = await this.kit.signTransaction(xdr, {
      networkPassphrase: this.networkPassphrase,
    });
    return signedTxXdr;
  }

  async submitTransaction(signedXdr: string): Promise<{ hash: string; success: boolean }> {
    const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, this.networkPassphrase);
    const result = await this.server.submitTransaction(tx as StellarSdk.Transaction);
    return { hash: result.hash, success: result.successful };
  }

  getExplorerLink(hash: string, type: 'tx' | 'account' = 'tx'): string {
    const net = this.networkPassphrase === StellarSdk.Networks.TESTNET ? 'testnet' : 'public';
    return `https://stellar.expert/explorer/${net}/${type}/${hash}`;
  }

  formatAddress(address: string, start = 4, end = 4): string {
    if (address.length <= start + end) return address;
    return `${address.slice(0, start)}...${address.slice(-end)}`;
  }

  disconnect() {
    this.publicKey = null;
    return true;
  }
}

export const stellar = new StellarHelper('testnet');
```

### 1.3 Create `src/components/WalletConnection.tsx`
Full component supporting Freighter, xBull, Albedo, Rabet, Lobstr, Hana, WalletConnect:

```tsx
'use client';
import { useState } from 'react';
import { stellar } from '@/lib/stellar-helper';
import { FaWallet, FaCopy, FaCheck } from 'react-icons/fa';
import { MdLogout } from 'react-icons/md';

interface WalletConnectionProps {
  onConnect: (publicKey: string) => void;
  onDisconnect: () => void;
}

export default function WalletConnection({ onConnect, onDisconnect }: WalletConnectionProps) {
  const [publicKey, setPublicKey] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConnect = async () => {
    try {
      setLoading(true);
      const key = await stellar.connectWallet();
      setPublicKey(key);
      setIsConnected(true);
      onConnect(key);
    } catch (error: any) {
      console.error('Connection error:', error);
      alert(`Failed to connect wallet:\n${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = () => {
    stellar.disconnect();
    setPublicKey('');
    setIsConnected(false);
    onDisconnect();
  };

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isConnected) {
    return (
      <div className="p-6 rounded-2xl bg-card border border-border">
        <p className="text-muted-foreground mb-6 text-sm">
          Connect your Stellar wallet to view your balance and make transactions.
        </p>
        <button
          onClick={handleConnect}
          disabled={loading}
          className="w-full bg-primary text-primary-foreground font-bold py-3 px-6 rounded-xl hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-4 border-white border-r-transparent" />
              Connecting...
            </>
          ) : (
            <><FaWallet /> Connect Wallet</>
          )}
        </button>
        <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-muted-foreground text-xs mb-2 font-semibold">Supported Wallets</p>
          <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
            {['Freighter','xBull','Albedo','Rabet','Lobstr','Hana','WalletConnect','More...'].map(w => (
              <div key={w}>✓ {w}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-2xl bg-card border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-primary rounded-full animate-pulse" />
          <span className="text-muted-foreground text-sm">Connected</span>
        </div>
        <button
          onClick={handleDisconnect}
          className="text-destructive hover:text-destructive/80 text-sm flex items-center gap-1.5 transition-colors"
        >
          <MdLogout /> Disconnect
        </button>
      </div>
      <div className="bg-background/60 rounded-xl p-4 border border-border">
        <p className="text-muted-foreground text-xs mb-2">Your Address</p>
        <div className="flex items-center justify-between gap-3">
          <p className="text-foreground font-mono text-sm break-all">{publicKey}</p>
          <button
            onClick={handleCopyAddress}
            className="text-primary hover:text-primary/80 text-lg flex-shrink-0 transition-colors"
            title={copied ? 'Copied!' : 'Copy address'}
          >
            {copied ? <FaCheck className="text-primary" /> : <FaCopy />}
          </button>
        </div>
      </div>
      <div className="mt-3">
        <a
          href={stellar.getExplorerLink(publicKey, 'account')}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline text-xs"
        >
          View on Stellar Expert →
        </a>
      </div>
    </div>
  );
}
```

### 1.4 Wire into Zustand store (`src/lib/store.ts`)
- Replace `connect: () => set({ walletAddress: rndAddr() })` with a call to `stellar.connectWallet()`
- On connect success: fetch real USDC balance via `stellar.getBalance(address)`, find the USDC asset, set `walletBalanceUsdc`
- Replace `disconnect` to call `stellar.disconnect()`
- Store the real `walletAddress` returned from the kit

### 1.5 Update `AppNav.tsx`
- Replace the inline `connect()` call with `WalletConnection` component or keep the button but call `stellar.connectWallet()` directly
- Fix ticker: change "Stellar Mainnet" → "Stellar Testnet"
- Remove hardcoded block number or fetch live from Horizon

---

## Task 2 — Trustless Work API Client

### 2.1 Install dependency
```bash
bun add axios  # or use native fetch — no extra dep needed
```

### 2.2 Create `src/lib/trustless/client.ts`
```ts
const BASE = 'https://api.trustlesswork.com'; // confirm current base URL
const API_KEY = import.meta.env.VITE_TRUSTLESS_API_KEY;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`,
};

export const trustless = {
  /** Deploy a single-release escrow. Returns { contractId, unsignedXdr } */
  deployEscrow: async (params: {
    funder: string;       // seller Stellar address
    serviceProvider: string; // buyer Stellar address
    approver: string;     // seller address
    receiver: string;     // buyer address
    releaseSigner: string; // platform address
    disputeResolver: string;
    amount: string;       // USDC amount as string
    description: string;
  }) => {
    const res = await fetch(`${BASE}/deployer/single-release`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ contractId: string; unsignedXdr: string }>;
  },

  /** Fund the escrow after seller signs the XDR */
  fundEscrow: async (contractId: string, signedXdr: string) => {
    const res = await fetch(`${BASE}/escrow/${contractId}/fund`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ signedXdr }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ txHash: string }>;
  },

  /** Upload evidence to a milestone */
  uploadMilestoneEvidence: async (contractId: string, evidenceUrl: string) => {
    const res = await fetch(`${BASE}/escrow/${contractId}/milestone/evidence`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ evidenceUrl }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** Approve and release funds to buyer */
  approveRelease: async (contractId: string, approverSignedXdr: string) => {
    const res = await fetch(`${BASE}/escrow/${contractId}/approve`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ signedXdr: approverSignedXdr }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<{ txHash: string }>;
  },

  /** Open a dispute */
  openDispute: async (contractId: string) => {
    const res = await fetch(`${BASE}/escrow/${contractId}/dispute`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },

  /** Fetch all active escrows (for marketplace listing) */
  listEscrows: async () => {
    const res = await fetch(`${BASE}/escrows`, { headers });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
```

### 2.3 Create `.env` file
```
VITE_TRUSTLESS_API_KEY=your_api_key_here
VITE_PUSHER_KEY=your_pusher_key
VITE_PUSHER_CLUSTER=eu
VITE_PINATA_JWT=your_pinata_jwt
VITE_PLATFORM_ADDRESS=your_platform_stellar_address
```

---

## Task 3 — Real Escrow Deploy + Fund in Create Offer

Update `src/routes/create-offer.tsx`:

### 3.1 Replace mock `sign()` function
```ts
const sign = async () => {
  try {
    setStep('sign');

    // 1. Deploy escrow via Trustless Work API
    const { contractId, unsignedXdr } = await trustless.deployEscrow({
      funder: walletAddress!,
      serviceProvider: walletAddress!, // buyer TBD — set to platform for now
      approver: walletAddress!,
      receiver: walletAddress!, // will be updated when buyer claims
      releaseSigner: import.meta.env.VITE_PLATFORM_ADDRESS,
      disputeResolver: import.meta.env.VITE_PLATFORM_ADDRESS,
      amount: String(amount),
      description: `Sell ${amount} USDC for ${currency} at ${price.toFixed(2)}`,
    });

    // 2. Seller signs the XDR with their wallet
    const signedXdr = await stellar.signTransaction(unsignedXdr);

    // 3. Submit signed XDR to fund the escrow
    const { txHash } = await trustless.fundEscrow(contractId, signedXdr);

    // 4. Save offer with real contract data
    addOffer({
      ...formData,
      escrowContract: contractId,
      txHash,
    });

    setStep('done');
    toast.success(`${amount} USDC locked in Soroban escrow · ${contractId.slice(0, 8)}…`);
  } catch (err: any) {
    toast.error(err.message);
    setStep('form');
  }
};
```

### 3.2 Update `Offer` type in `store.ts`
Add `escrowContract: string` and `txHash: string` fields to the `Offer` interface.

---

## Task 4 — IPFS Evidence Upload (Pinata)

### 4.1 Create `src/lib/pinata.ts`
```ts
const PINATA_JWT = import.meta.env.VITE_PINATA_JWT;

export async function pinFileToIPFS(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('pinataMetadata', JSON.stringify({ name: `evidence-${Date.now()}` }));

  const res = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: { Authorization: `Bearer ${PINATA_JWT}` },
    body: formData,
  });

  if (!res.ok) throw new Error('Failed to pin file to IPFS');
  const data = await res.json();
  return `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`;
}
```

### 4.2 Update evidence upload in `trade.$id.tsx`
Replace the `FileReader` dataUrl approach:
```ts
const handleFile = async (file: File) => {
  try {
    toast.loading('Pinning evidence to IPFS…');
    const ipfsUrl = await pinFileToIPFS(file);
    await trustless.uploadMilestoneEvidence(trade.escrowContract, ipfsUrl);
    uploadEvidence(trade.id, ipfsUrl); // store URL not dataUrl
    toast.success('Evidence pinned to escrow milestone');
  } catch (err: any) {
    toast.error('Upload failed: ' + err.message);
  }
};
```

### 4.3 Update `Trade` type in `store.ts`
- Rename `evidenceDataUrl` → `evidenceUrl: string` (stores IPFS URL)
- Update all references in `trade.$id.tsx` and `store.ts`

---

## Task 5 — Real-Time Notifications (Pusher)

### 5.1 Install
```bash
bun add pusher pusher-js
```

### 5.2 Create `src/lib/pusher.ts`
```ts
import Pusher from 'pusher-js';

export const pusherClient = new Pusher(import.meta.env.VITE_PUSHER_KEY, {
  cluster: import.meta.env.VITE_PUSHER_CLUSTER,
});

export function subscribeToTrade(
  tradeId: string,
  onEvidenceUploaded: () => void
) {
  const channel = pusherClient.subscribe(`trade-${tradeId}`);
  channel.bind('evidence-uploaded', onEvidenceUploaded);
  return () => pusherClient.unsubscribe(`trade-${tradeId}`);
}
```

### 5.3 Emit event on evidence upload
In `trade.$id.tsx`, after successful IPFS pin + milestone update, trigger a Pusher event via a lightweight server route or Pusher's REST API directly:
```ts
// POST /api/notify with { tradeId, event: 'evidence-uploaded' }
// Server route calls pusher.trigger(`trade-${tradeId}`, 'evidence-uploaded', {})
```

### 5.4 Subscribe in seller's trade view
In `TradePage`, add a `useEffect` that subscribes when `!isBuyer && trade.status === 'funded'`:
```ts
useEffect(() => {
  if (isBuyer || trade.status !== 'funded') return;
  const unsub = subscribeToTrade(trade.id, () => {
    toast.success('Buyer uploaded payment proof — check and approve');
    // refetch trade state
  });
  return unsub;
}, [trade.id, isBuyer, trade.status]);
```

---

## Task 6 — Approve & Release (Real On-Chain)

Update `approveRelease` in `trade.$id.tsx`:

```ts
const handleApprove = async () => {
  try {
    // 1. Get unsigned approve XDR from Trustless Work
    const res = await fetch(`${BASE}/escrow/${trade.escrowContract}/approve/prepare`, {
      method: 'POST', headers,
    });
    const { unsignedXdr } = await res.json();

    // 2. Seller signs
    const signedXdr = await stellar.signTransaction(unsignedXdr);

    // 3. Submit
    const { txHash } = await trustless.approveRelease(trade.escrowContract, signedXdr);

    approveRelease(trade.id); // update local state
    toast.success(`${fmtUsdc(trade.amountUsdc)} released · tx ${txHash.slice(0, 10)}…`);
  } catch (err: any) {
    toast.error('Release failed: ' + err.message);
  }
};
```

---

## Task 7 — UI Fixes & Polish

### 7.1 Fix AppNav ticker
- Change `"Stellar Mainnet · Soroban v2 · Synced"` → `"Stellar Testnet · Soroban v2 · Synced"`
- Remove hardcoded block number `512,892,104` — either fetch from Horizon or remove

### 7.2 Fix broken "Submit Evidence" button in `trade.$id.tsx`
Current state: permanently disabled no-op. Fix:
- Show active for buyer when `trade.status === 'funded'` and no evidence yet
- Clicking it should trigger `fileRef.current?.click()`

### 7.3 Add loading states
- Wallet connect button: spinner while `stellar.connectWallet()` resolves
- "Sign & Lock" button: spinner while deploy + fund is in progress
- "Approve & Release" button: spinner while signing + submitting

### 7.4 Add post-trade rating stub
After `trade.status === 'released'`, show a simple 1–5 star rating prompt for both parties. Store rating in Zustand for now; wire to API later.

### 7.5 Mobile nav
Add a hamburger menu for the `hidden md:flex` nav links in `AppNav.tsx` so mobile users can reach Marketplace, My Trades, and Sell.

---

## Task 8 — Dispute Flow Stub

### 8.1 Update `disputeTrade` in `store.ts`
Call `trustless.openDispute(trade.escrowContract)` before updating local state.

### 8.2 Add dispute status UI in `trade.$id.tsx`
When `trade.status === 'disputed'`, show:
- A banner: "Dispute open — arbiter reviewing evidence"
- Link to evidence IPFS URL
- Estimated resolution time copy

---

## Completion Checklist

- [ ] `stellar-helper.ts` created with `StellarWalletsKit`
- [ ] `WalletConnection.tsx` component wired into `AppNav`
- [ ] Real wallet address + USDC balance in Zustand store
- [ ] `trustless/client.ts` API wrapper created
- [ ] `.env` file with all keys (not committed)
- [ ] Create offer deploys real escrow + seller signs XDR
- [ ] Evidence uploads to Pinata IPFS, CID stored on milestone
- [ ] Pusher subscription notifies seller on evidence upload
- [ ] Approve & Release signs and submits real on-chain tx
- [ ] AppNav shows "Testnet" not "Mainnet"
- [ ] Submit Evidence button fixed for buyers
- [ ] Loading spinners on all async actions
- [ ] Mobile nav hamburger menu
- [ ] Post-trade rating stub
- [ ] Dispute flow calls Trustless Work API
