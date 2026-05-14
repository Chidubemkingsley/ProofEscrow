import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { useApp, type Currency, shortAddr } from "@/lib/store";
import { stellar } from "@/lib/stellar-helper";
import { trustless, USDC_TRUSTLINE } from "@/lib/trustless/client";
import { getBankNames } from "@/lib/banks";
import { Lock, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/create-offer")({
  component: CreateOffer,
  head: () => ({
    meta: [
      { title: "Create Sell Offer — LocalP2P" },
      { name: "description", content: "List USDC for sale on the non-custodial LocalP2P marketplace." },
    ],
  }),
});

/** Platform-wide trade limits in USDC */
export const TRADE_LIMITS = {
  MIN_USDC: 5,       // $5 — low enough for onboarding, covers escrow fees
  MAX_USDC: 5000,    // $5,000 — under daily bank transfer scrutiny thresholds
  LARGE_TRADE: 1000, // $1,000+ — show a soft bank-limit reminder
} as const;

const PLATFORM_ADDRESS = import.meta.env.VITE_PLATFORM_ADDRESS ?? "";

function CreateOffer() {
  const { walletAddress, walletBalanceUsdc, walletConnecting, rates, ratesLoading, fetchRates, addOffer, connect } = useApp();
  const navigate = useNavigate();
  const [currency, setCurrency] = useState<Currency>("NGN");
  const [amount, setAmount] = useState(100);
  const [margin, setMargin] = useState(0.5);
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [minLimit, setMinLimit] = useState(TRADE_LIMITS.MIN_USDC);
  const [maxLimit, setMaxLimit] = useState(TRADE_LIMITS.MAX_USDC);
  const [step, setStep] = useState<"form" | "sign" | "done">("form");
  const [signing, setSigning] = useState(false);
  const [deployedContract, setDeployedContract] = useState<string>("");
  const [deployedTxHash, setDeployedTxHash] = useState<string>("");

  // Fetch live rates on mount
  useEffect(() => { fetchRates(); }, []);

  // Reset bank when currency changes
  useEffect(() => { setBank(""); }, [currency]);

  const baseRate = rates[currency];
  const price = baseRate * (1 + margin / 100);
  const bankList = getBankNames(currency);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress) {
      try {
        await connect();
        toast.success("Wallet connected — review and lock USDC");
      } catch (err: any) {
        toast.error(err?.message ?? "Failed to connect wallet");
      }
      return;
    }
    // Validate limits
    if (amount < TRADE_LIMITS.MIN_USDC) {
      toast.error(`Minimum offer size is $${TRADE_LIMITS.MIN_USDC} USDC`);
      return;
    }
    if (amount > TRADE_LIMITS.MAX_USDC) {
      toast.error(`Maximum offer size is $${TRADE_LIMITS.MAX_USDC.toLocaleString()} USDC`);
      return;
    }
    if (minLimit < TRADE_LIMITS.MIN_USDC) {
      toast.error(`Minimum trade limit is $${TRADE_LIMITS.MIN_USDC} USDC`);
      return;
    }
    if (maxLimit > TRADE_LIMITS.MAX_USDC) {
      toast.error(`Maximum trade limit is $${TRADE_LIMITS.MAX_USDC.toLocaleString()} USDC`);
      return;
    }
    if (minLimit > maxLimit) {
      toast.error("Min limit cannot exceed max limit");
      return;
    }
    if (amount > walletBalanceUsdc) {
      toast.error("Insufficient USDC balance");
      return;
    }
    setStep("sign");
  };

  const sign = async () => {
    setSigning(true);
    try {
      const engagementId = `LP2P-${Date.now()}`;

      // Step 1: Deploy — get unsigned XDR from Trustless Work
      toast.loading("Deploying escrow contract…", { id: "deploy" });
      const deployRes = await trustless.deployEscrow({
        signer: walletAddress!,
        engagementId,
        title: `LocalP2P Sell ${amount} USDC → ${currency}`,
        description: `Sell ${amount} USDC for ${currency} at ${price.toFixed(2)} ${currency}/USDC`,
        roles: {
          approver: walletAddress!,
          serviceProvider: PLATFORM_ADDRESS || walletAddress!,
          platformAddress: PLATFORM_ADDRESS || walletAddress!,
          releaseSigner: PLATFORM_ADDRESS || walletAddress!,
          disputeResolver: PLATFORM_ADDRESS || walletAddress!,
          receiver: PLATFORM_ADDRESS || walletAddress!,
        },
        amount,
        platformFee: 1,
        milestones: [{ description: "Fiat payment confirmed by seller" }],
        trustline: USDC_TRUSTLINE,
      });
      toast.dismiss("deploy");

      // Step 2: Seller signs the deploy XDR
      toast.loading("Sign the deploy transaction in your wallet…", { id: "sign" });
      const signedDeployXdr = await stellar.signTransaction(deployRes.unsignedTransaction);
      toast.dismiss("sign");

      // Step 3: Submit deploy → get contractId back
      toast.loading("Deploying on Stellar…", { id: "submit-deploy" });
      const deployTx = await trustless.sendTransaction(signedDeployXdr);
      toast.dismiss("submit-deploy");
      const contractId = deployTx.contractId!;

      // Step 4: Fund — get unsigned XDR
      toast.loading("Preparing funding transaction…", { id: "fund" });
      const fundRes = await trustless.fundEscrow(contractId, walletAddress!, amount);
      toast.dismiss("fund");

      // Step 5: Seller signs the fund XDR
      toast.loading("Sign the funding transaction in your wallet…", { id: "sign-fund" });
      const signedFundXdr = await stellar.signTransaction(fundRes.unsignedTransaction);
      toast.dismiss("sign-fund");

      // Step 6: Submit fund
      toast.loading("Locking USDC on-chain…", { id: "submit-fund" });
      const fundTx = await trustless.sendTransaction(signedFundXdr);
      toast.dismiss("submit-fund");

      setDeployedContract(contractId);
      setDeployedTxHash(fundTx.message ?? contractId);

      // Step 7: Save offer with real contract data
      addOffer({
        sellerName: shortAddr(walletAddress!),
        sellerAddress: walletAddress!,
        rating: 5.0,
        trades: 0,
        pricePerUsdc: Number(price.toFixed(2)),
        currency,
        available: amount,
        minLimit,
        maxLimit,
        bank,
        accountNumber,
        accountName,
        paymentSpeed: "~5 min",
        verified: false,
        escrowContract: contractId,
        txHash: fundTx.message ?? contractId,
      });

      setStep("done");
      toast.success(`${amount} USDC locked · contract ${contractId.slice(0, 8)}…`);
    } catch (err: any) {
      ["deploy","sign","submit-deploy","fund","sign-fund","submit-fund"].forEach(id => toast.dismiss(id));
      toast.error(err?.message ?? "Transaction failed");
      setStep("form");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />
      <main className="max-w-3xl mx-auto px-4 md:px-8 py-10">
        <div className="mb-6">
          <p className="text-[10px] font-mono uppercase tracking-widest text-primary mb-2">Step 1 / 2 · Single-Release Escrow</p>
          <h1 className="text-3xl font-bold tracking-tight">Create a sell offer</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Lock USDC in a Soroban contract. Buyers pay you in fiat, you approve, contract releases. LocalP2P never touches your money.
          </p>
        </div>

        {step === "form" && (
          <form onSubmit={submit} className="bg-card border border-border rounded-2xl p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Fiat currency">
                <div className="inline-flex p-1 rounded-lg bg-background border border-border">
                  {(["NGN", "GHS", "KES"] as Currency[]).map((c) => (
                    <button
                      type="button"
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={`px-4 py-1.5 rounded-md text-xs font-semibold ${currency === c ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label={`USDC amount to lock (balance: ${walletBalanceUsdc.toFixed(2)})`}>
                <input
                  type="number"
                  min={TRADE_LIMITS.MIN_USDC}
                  max={TRADE_LIMITS.MAX_USDC}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="input"
                />
                {amount >= TRADE_LIMITS.LARGE_TRADE && (
                  <p className="text-[10px] text-yellow-500 font-mono mt-1">
                    ⚠ Large trade — confirm your bank can receive {(amount * price).toLocaleString()} {currency} in a single transfer
                  </p>
                )}
              </Field>
              <Field label="Margin above market (%)">
                <input type="number" step={0.1} value={margin} onChange={(e) => setMargin(Number(e.target.value))} className="input" />
              </Field>
              <Field label={`Resulting price (${currency} per USDC)`}>
                <div className="input font-mono text-primary flex items-center justify-between">
                  <span>{price.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={fetchRates}
                    disabled={ratesLoading}
                    className="text-muted-foreground hover:text-primary transition"
                    title="Refresh live rate"
                  >
                    <RefreshCw className={`size-3.5 ${ratesLoading ? "animate-spin" : ""}`} />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground font-mono mt-1">
                  Live rate: 1 USDC = {baseRate.toFixed(2)} {currency}
                  {ratesLoading && " · refreshing…"}
                </p>
              </Field>
              <Field label={`Min trade (USDC) — platform min: $${TRADE_LIMITS.MIN_USDC}`}>
                <input
                  type="number"
                  min={TRADE_LIMITS.MIN_USDC}
                  max={maxLimit}
                  value={minLimit}
                  onChange={(e) => setMinLimit(Number(e.target.value))}
                  className="input"
                />
              </Field>
              <Field label={`Max trade (USDC) — platform max: $${TRADE_LIMITS.MAX_USDC.toLocaleString()}`}>
                <input
                  type="number"
                  min={minLimit}
                  max={TRADE_LIMITS.MAX_USDC}
                  value={maxLimit}
                  onChange={(e) => setMaxLimit(Number(e.target.value))}
                  className="input"
                />
              </Field>
            </div>

            <div className="border-t border-border pt-6 space-y-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Payment destination</p>
              <div className="grid md:grid-cols-2 gap-4">
                <Field label="Bank / Payment provider">
                  <select
                    value={bank}
                    onChange={(e) => setBank(e.target.value)}
                    className="input"
                    required
                  >
                    <option value="" disabled>Select your bank…</option>
                    {bankList.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Account number / Phone">
                  <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="input" required placeholder="e.g. 0812 345 6789" />
                </Field>
                <Field label="Account name" full>
                  <input value={accountName} onChange={(e) => setAccountName(e.target.value)} className="input" required placeholder="Name on account" />
                </Field>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={walletConnecting}
                className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-bold text-sm shadow-[0_0_24px_rgba(16,185,129,0.3)] hover:opacity-90 transition disabled:opacity-60 flex items-center gap-2"
              >
                {walletConnecting && <Loader2 className="size-4 animate-spin" />}
                {walletAddress ? "Review & Lock USDC" : "Connect Wallet"}
              </button>
            </div>

            <style>{`.input { width:100%; background:var(--background); border:1px solid var(--border); border-radius:0.5rem; padding:0.5rem 0.75rem; font-size:0.875rem; outline:none; } .input:focus { border-color: var(--primary); }`}</style>
          </form>
        )}

        {step === "sign" && (
          <div className="bg-card border border-primary/30 rounded-2xl p-8 text-center">
            <Lock className="size-10 mx-auto text-primary mb-4" />
            <h2 className="text-xl font-bold">Sign the funding transaction</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Your wallet will deploy a single-release Soroban escrow and lock{" "}
              <span className="text-primary font-mono">{amount} USDC</span>. Once funded, the offer goes live.
            </p>
            <div className="mt-6 inline-block p-4 rounded-xl bg-background/60 border border-border text-left text-xs font-mono space-y-1">
              <div><span className="text-muted-foreground">contract:</span> single-release-v2</div>
              <div><span className="text-muted-foreground">network:</span> Stellar Testnet</div>
              <div><span className="text-muted-foreground">asset:</span> USDC</div>
              <div><span className="text-muted-foreground">amount:</span> <span className="text-primary">{amount}</span></div>
              <div><span className="text-muted-foreground">price:</span> {price.toFixed(2)} {currency}/USDC</div>
            </div>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => setStep("form")}
                disabled={signing}
                className="px-5 py-2.5 bg-secondary border border-border rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                Back
              </button>
              <button
                onClick={sign}
                disabled={signing}
                className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold shadow-[0_0_24px_rgba(16,185,129,0.3)] disabled:opacity-60 flex items-center gap-2"
              >
                {signing && <Loader2 className="size-4 animate-spin" />}
                {signing ? "Processing…" : "Sign & Lock"}
              </button>
            </div>
          </div>
        )}

        {step === "done" && (
          <div className="bg-card border border-primary/30 rounded-2xl p-8 text-center">
            <div className="size-12 mx-auto rounded-full bg-primary/15 grid place-items-center mb-4">
              <Lock className="size-6 text-primary" />
            </div>
            <h2 className="text-xl font-bold">Offer live</h2>
            <p className="text-sm text-muted-foreground mt-2">Your escrow is funded. Buyers can now match on the marketplace.</p>
            {deployedContract && (
              <div className="mt-4 p-3 rounded-xl bg-background/60 border border-border text-xs font-mono text-left space-y-1">
                <div><span className="text-muted-foreground">contract:</span> <span className="text-primary break-all">{deployedContract}</span></div>
                {deployedTxHash && (
                  <div>
                    <span className="text-muted-foreground">tx: </span>
                    <a
                      href={stellar.getExplorerLink(deployedTxHash, "tx")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {deployedTxHash.slice(0, 16)}…
                    </a>
                  </div>
                )}
              </div>
            )}
            <button
              onClick={() => navigate({ to: "/" })}
              className="mt-6 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-bold"
            >
              View Marketplace
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? "md:col-span-2" : ""}`}>
      <span className="block text-[10px] font-mono uppercase tracking-tighter text-muted-foreground mb-1.5">{label}</span>
      {children}
    </label>
  );
}
