import { createFileRoute, Link } from "@tanstack/react-router";
import { AppNav } from "@/components/AppNav";
import { useApp, fmtFiat, fmtUsdc } from "@/lib/store";

export const Route = createFileRoute("/my-trades")({
  component: MyTrades,
  head: () => ({ meta: [{ title: "My Trades — LocalP2P" }] }),
});

const STATUS_STYLE: Record<string, string> = {
  funded: "bg-primary/10 text-primary ring-primary/20",
  paid: "bg-yellow-500/10 text-yellow-500 ring-yellow-500/20",
  released: "bg-secondary text-muted-foreground ring-border",
  disputed: "bg-destructive/10 text-destructive ring-destructive/20",
  cancelled: "bg-secondary text-muted-foreground ring-border",
};

function MyTrades() {
  const { trades, walletAddress } = useApp();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-10">
        <h1 className="text-3xl font-bold tracking-tight">My Trades</h1>
        <p className="text-sm text-muted-foreground mt-1">Active and historical trades for {walletAddress ? walletAddress.slice(0, 8) + "…" : "your wallet"}.</p>

        <div className="mt-6 border border-border rounded-2xl overflow-hidden bg-card">
          {trades.length === 0 && (
            <div className="py-16 text-center text-sm text-muted-foreground">
              No trades yet. <Link to="/" className="text-primary hover:underline">Browse the marketplace</Link> to start.
            </div>
          )}
          {trades.map((t) => (
            <Link
              key={t.id}
              to="/trade/$id"
              params={{ id: t.id }}
              className="grid grid-cols-12 gap-2 px-5 py-4 items-center border-b border-border last:border-b-0 hover:bg-background/50 transition"
            >
              <div className="col-span-3 font-mono text-xs">#{t.id}</div>
              <div className="col-span-3">
                <div className="text-sm font-semibold">{t.sellerName}</div>
                <div className="text-[10px] font-mono text-muted-foreground">{new Date(t.createdAt).toLocaleString()}</div>
              </div>
              <div className="col-span-3 text-right text-sm font-mono">{fmtUsdc(t.amountUsdc)} <span className="text-muted-foreground">·</span> {fmtFiat(t.fiatAmount, t.currency)}</div>
              <div className="col-span-3 text-right">
                <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ring-1 ${STATUS_STYLE[t.status]}`}>{t.status}</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}