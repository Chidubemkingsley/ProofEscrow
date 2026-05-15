import { Link, useLocation } from "@tanstack/react-router";
import { useApp, shortAddr } from "@/lib/store";
import { toast } from "sonner";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function AppNav() {
  const { walletAddress, walletBalanceUsdc, walletConnecting, rates, connect, disconnect } = useApp();
  const loc = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLink = (to: string, label: string) => {
    const active = loc.pathname === to || (to !== "/" && loc.pathname.startsWith(to));
    return (
      <Link
        to={to}
        onClick={() => setMobileOpen(false)}
        className={`text-sm font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        {label}
      </Link>
    );
  };

  const handleConnect = async () => {
    try {
      await connect();
      toast.success("Wallet connected");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to connect wallet");
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast.success("Wallet disconnected");
  };

  return (
    <>
      {/* Live ticker */}
      <div className="h-8 bg-card border-b border-border flex items-center px-4 gap-6 overflow-hidden text-[10px] font-mono uppercase tracking-tighter">
        <div className="flex items-center gap-2 shrink-0">
          <span className="size-1.5 rounded-full bg-primary animate-pulse-dot" />
          <span className="text-muted-foreground">Stellar Testnet · Soroban v2 · Synced</span>
        </div>
        <div className="hidden md:flex gap-5 text-muted-foreground">
          <span>NGN/USDC <span className="text-primary">{rates.NGN.toLocaleString()}</span></span>
          <span>GHS/USDC <span className="text-foreground">{rates.GHS.toFixed(2)}</span></span>
          <span>KES/USDC <span className="text-foreground">{rates.KES.toFixed(2)}</span></span>
        </div>
        <div className="ml-auto text-muted-foreground/60 hidden sm:block">Trustless Work · USDC</div>
      </div>

      <nav className="border-b border-border h-16 flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur-md z-50 px-4 md:px-8">
        <div className="flex items-center gap-8">
          <Link to="/" className="text-lg font-bold tracking-tighter text-foreground flex items-center gap-2">
            <span className="size-2.5 bg-primary rounded-full animate-pulse-dot shadow-[0_0_12px_var(--color-primary)]" />
            Settl<span className="text-primary">a</span>
          </Link>
          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {navLink("/", "Marketplace")}
            {navLink("/my-trades", "My Trades")}
            {navLink("/create-offer", "Sell")}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {walletAddress ? (
            <>
              <div className="hidden sm:flex flex-col items-end pr-3 border-r border-border">
                <span className="text-[10px] font-mono uppercase tracking-tighter text-muted-foreground leading-none">Balance</span>
                <span className="text-xs font-semibold font-mono">{walletBalanceUsdc.toFixed(2)} USDC</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 rounded-full border border-border bg-card/50 text-[12px] font-mono flex items-center gap-2 hover:border-destructive/40 hover:text-destructive transition-colors"
              >
                <span className="size-2 rounded-full bg-primary" />
                {shortAddr(walletAddress)}
              </button>
            </>
          ) : (
            <button
              onClick={handleConnect}
              disabled={walletConnecting}
              className="bg-primary text-primary-foreground px-4 py-1.5 rounded-lg text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_24px_rgba(16,185,129,0.25)] disabled:opacity-60 flex items-center gap-2"
            >
              {walletConnecting ? (
                <>
                  <span className="size-3.5 rounded-full border-2 border-primary-foreground border-r-transparent animate-spin" />
                  Connecting…
                </>
              ) : (
                "Connect Wallet"
              )}
            </button>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg border border-border hover:border-primary/40 transition-colors"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile nav drawer */}
      {mobileOpen && (
        <div className="md:hidden border-b border-border bg-background/95 backdrop-blur-md px-4 py-4 flex flex-col gap-4 z-40">
          {navLink("/", "Marketplace")}
          {navLink("/my-trades", "My Trades")}
          {navLink("/create-offer", "Sell USDC")}
        </div>
      )}
    </>
  );
}
