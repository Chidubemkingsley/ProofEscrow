import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppNav } from "@/components/AppNav";
import { useApp, fmtFiat, fmtUsdc, shortAddr } from "@/lib/store";
import { stellar } from "@/lib/stellar-helper";
import { trustless } from "@/lib/trustless/client";
import { pinFileToIPFS } from "@/lib/pinata";
import { subscribeToTrade, notifyEvidenceUploaded } from "@/lib/pusher";
import { Check, Lock, Upload, Copy, AlertTriangle, Send, Loader2, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/trade/$id")({
  component: TradePage,
});

function TradePage() {
  const { id } = useParams({ from: "/trade/$id" });
  const { trades, walletAddress, uploadEvidence, approveRelease, cancelTrade, disputeTrade, sendMessage } = useApp();
  const trade = trades.find((t) => t.id === id);
  const [draft, setDraft] = useState("");
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [approvingRelease, setApprovingRelease] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [trade?.messages.length]);

  // Seller subscribes to real-time evidence notifications
  useEffect(() => {
    if (!trade || !walletAddress) return;
    const isBuyer = walletAddress === trade.buyerAddress;
    if (isBuyer || trade.status !== "funded") return;

    const unsub = subscribeToTrade(trade.id, () => {
      toast.success("Buyer uploaded payment proof — check and approve");
    });
    return unsub;
  }, [trade?.id, trade?.status, walletAddress]);

  if (!trade) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <AppNav />
        <div className="max-w-2xl mx-auto py-24 text-center">
          <h1 className="text-2xl font-bold">Trade not found</h1>
          <p className="text-muted-foreground mt-2 text-sm">It may have been settled or never existed.</p>
          <Link to="/" className="inline-block mt-6 text-primary hover:underline text-sm">Back to marketplace</Link>
        </div>
      </div>
    );
  }

  const isDemo = trade.offerId.startsWith("demo-") || trade.sellerName.startsWith("[DEMO]");
  const isBuyer = walletAddress === trade.buyerAddress;
  // In demo mode, the person viewing is always the buyer (they opened the trade)
  const effectiveIsBuyer = isDemo ? true : isBuyer;
  const role = effectiveIsBuyer ? "buyer" : "seller";

  const steps = [
    { key: "funded", label: "Locked" },
    { key: "paid", label: "Evidence" },
    { key: "released", label: "Released" },
  ] as const;

  const stepIndex =
    trade.status === "funded" ? 0 : trade.status === "paid" ? 1 : trade.status === "released" ? 2 : 0;

  const handleFile = async (file: File) => {
    setUploadingEvidence(true);
    try {
      let evidenceUrl: string;

      if (isDemo) {
        // Demo mode — skip Pinata, use a local object URL
        evidenceUrl = URL.createObjectURL(file);
        await new Promise((r) => setTimeout(r, 800));
      } else {
        // Real trade — pin to IPFS via Pinata
        toast.loading("Pinning evidence to IPFS…", { id: "ipfs" });
        evidenceUrl = await pinFileToIPFS(file);
        toast.dismiss("ipfs");

        // Submit evidence on-chain via change-milestone-status
        // serviceProvider = buyer (walletAddress)
        toast.loading("Recording evidence on escrow…", { id: "milestone" });
        const statusRes = await trustless.changeMilestoneStatus(
          trade.escrowContract,
          walletAddress!,
          evidenceUrl
        );
        toast.dismiss("milestone");

        toast.loading("Sign the evidence transaction…", { id: "sign-evidence" });
        const signedXdr = await stellar.signTransaction(statusRes.unsignedTransaction);
        toast.dismiss("sign-evidence");

        toast.loading("Submitting to Stellar…", { id: "submit-evidence" });
        await trustless.sendTransaction(signedXdr);
        toast.dismiss("submit-evidence");

        // Notify seller via Pusher
        notifyEvidenceUploaded(trade.id);
      }

      uploadEvidence(trade.id, evidenceUrl);
      toast.success(isDemo ? "Demo evidence submitted" : "Evidence pinned to escrow milestone");
    } catch (err: any) {
      ["ipfs","milestone","sign-evidence","submit-evidence"].forEach(id => toast.dismiss(id));
      toast.error("Upload failed: " + (err?.message ?? "Unknown error"));
    } finally {
      setUploadingEvidence(false);
    }
  };

  const handleApprove = async () => {
    setApprovingRelease(true);
    try {
      if (!isDemo && trade.escrowContract) {
        // Step 1: Approve milestone (seller signs)
        toast.loading("Preparing approval…", { id: "approve" });
        const approveRes = await trustless.approveMilestone(trade.escrowContract, walletAddress!);
        toast.dismiss("approve");

        toast.loading("Sign the approval in your wallet…", { id: "sign-approve" });
        const signedApproveXdr = await stellar.signTransaction(approveRes.unsignedTransaction);
        toast.dismiss("sign-approve");

        toast.loading("Submitting approval…", { id: "submit-approve" });
        await trustless.sendTransaction(signedApproveXdr);
        toast.dismiss("submit-approve");

        // Step 2: Release funds (releaseSigner = platform)
        // For MVP: platform signs client-side — in production move to server
        const PLATFORM_ADDRESS = import.meta.env.VITE_PLATFORM_ADDRESS ?? "";
        toast.loading("Preparing release…", { id: "release" });
        const releaseRes = await trustless.releaseFunds(trade.escrowContract, PLATFORM_ADDRESS);
        toast.dismiss("release");

        // Platform wallet signs — for hackathon demo we use the connected wallet
        // In production the platform signs server-side
        toast.loading("Sign the release in your wallet…", { id: "sign-release" });
        const signedReleaseXdr = await stellar.signTransaction(releaseRes.unsignedTransaction);
        toast.dismiss("sign-release");

        toast.loading("Releasing funds on-chain…", { id: "submit-release" });
        const releaseTx = await trustless.sendTransaction(signedReleaseXdr);
        toast.dismiss("submit-release");

        toast.success(`${fmtUsdc(trade.amountUsdc)} released · ${releaseTx.message?.slice(0, 20) ?? ""}…`);
      }

      approveRelease(trade.id);
    } catch (err: any) {
      ["approve","sign-approve","submit-approve","release","sign-release","submit-release"].forEach(id => toast.dismiss(id));
      toast.error("Release failed: " + (err?.message ?? "Unknown error"));
    } finally {
      setApprovingRelease(false);
    }
  };

  const handleDispute = async () => {
    try {
      if (!isDemo && trade.escrowContract) {
        // Either buyer or seller can raise a dispute
        toast.loading("Preparing dispute…", { id: "dispute" });
        const disputeRes = await trustless.disputeEscrow(trade.escrowContract, walletAddress!);
        toast.dismiss("dispute");

        toast.loading("Sign the dispute transaction…", { id: "sign-dispute" });
        const signedXdr = await stellar.signTransaction(disputeRes.unsignedTransaction);
        toast.dismiss("sign-dispute");

        toast.loading("Submitting dispute…", { id: "submit-dispute" });
        await trustless.sendTransaction(signedXdr);
        toast.dismiss("submit-dispute");
      }

      disputeTrade(trade.id);
      toast("Dispute opened — arbiter notified");
    } catch (err: any) {
      ["dispute","sign-dispute","submit-dispute"].forEach(id => toast.dismiss(id));
      toast.error("Dispute failed: " + (err?.message ?? "Unknown error"));
    }
  };

  const copy = (val: string) => {
    navigator.clipboard.writeText(val);
    toast.success("Copied");
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppNav />
      <main className="max-w-6xl mx-auto px-4 md:px-8 py-8">
        <Link to="/" className="text-xs font-mono uppercase tracking-tighter text-muted-foreground hover:text-foreground">← Back to marketplace</Link>

        <div className="mt-4 grid lg:grid-cols-12 gap-6">
          {/* Main escrow panel */}
          <section className="lg:col-span-8">
            <div className="bg-card border border-primary/30 rounded-2xl overflow-hidden">
              <div className="bg-primary/5 px-6 py-4 border-b border-border flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="size-2 rounded-full bg-primary animate-pulse-dot" />
                  <h1 className="font-bold text-foreground">Trade #{trade.id}</h1>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                    {role === "buyer" ? "You're buying" : "You're selling"} {fmtUsdc(trade.amountUsdc)}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase ring-1 ring-primary/20 inline-flex items-center gap-1.5">
                  <Lock className="size-3" />
                  {trade.status === "released" ? "Released" : trade.status === "disputed" ? "Disputed" : trade.status === "cancelled" ? "Cancelled" : "Locked On-Chain"}
                </span>
              </div>

              <div className="p-6 space-y-7">
                {/* Progress */}
                <div className="relative">
                  <div className="absolute top-3 left-[8%] right-[8%] h-0.5 bg-border" />
                  <div
                    className="absolute top-3 left-[8%] h-0.5 bg-primary transition-all"
                    style={{ width: `${stepIndex === 0 ? 0 : stepIndex === 1 ? 42 : 84}%` }}
                  />
                  <div className="relative flex justify-between">
                    {steps.map((s, i) => (
                      <div key={s.key} className="flex flex-col items-center gap-2">
                        <div className={`size-6 rounded-full grid place-items-center text-[10px] font-bold ${i <= stepIndex ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground border border-border"}`}>
                          {i < stepIndex ? <Check className="size-3" /> : i + 1}
                        </div>
                        <span className={`text-[10px] uppercase tracking-wider ${i <= stepIndex ? "text-primary font-bold" : "text-muted-foreground"}`}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Amount summary */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-background/60 border border-border">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-tighter mb-1">Send</div>
                    <div className="text-2xl font-bold font-mono">{fmtFiat(trade.fiatAmount, trade.currency)}</div>
                  </div>
                  <div className="p-4 rounded-xl bg-background/60 border border-border">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground tracking-tighter mb-1">Receive</div>
                    <div className="text-2xl font-bold font-mono text-primary">{fmtUsdc(trade.amountUsdc)}</div>
                  </div>
                </div>

                {/* Bank details */}
                <div className="p-4 rounded-xl bg-background/60 border border-border">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Seller bank details</p>
                  {isDemo ? (
                    <div className="text-xs text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                      <p className="font-semibold mb-1">Demo trade — no real bank transfer needed</p>
                      <p className="text-muted-foreground">In a real trade, the seller's bank name, account number, and beneficiary name appear here. You would send the exact fiat amount shown above to that account, then upload your transfer screenshot as evidence.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      <BankRow label="Bank" value={trade.bank} />
                      <BankRow label="Account No." value={trade.accountNumber} mono onCopy={() => copy(trade.accountNumber)} />
                      <BankRow label="Beneficiary" value={trade.accountName} />
                      <BankRow label="Amount" value={fmtFiat(trade.fiatAmount, trade.currency)} mono onCopy={() => copy(String(trade.fiatAmount))} />
                    </div>
                  )}
                </div>

                {/* Evidence */}
                {trade.status !== "released" && trade.status !== "cancelled" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold">Payment evidence</p>
                      {isDemo && (
                        <span className="px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-500 text-[9px] font-bold tracking-widest uppercase ring-1 ring-yellow-500/20">
                          Demo mode
                        </span>
                      )}
                    </div>

                    {/* What to upload — instruction card */}
                    {!trade.evidenceUrl && effectiveIsBuyer && (
                      <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1.5">
                        {isDemo ? (
                          <>
                            <p className="text-primary font-semibold">This is a demo trade — no real bank transfer needed.</p>
                            <p>Upload any image (e.g. a screenshot from your phone) to test the evidence flow. In a real trade you would upload your bank transfer confirmation.</p>
                          </>
                        ) : (
                          <>
                            <p className="text-foreground font-semibold">What to upload:</p>
                            <ol className="list-decimal list-inside space-y-1">
                              <li>Open your banking app (OPay, Kuda, GTBank, etc.)</li>
                              <li>Send exactly <span className="text-primary font-mono font-bold">{fmtFiat(trade.fiatAmount, trade.currency)}</span> to the account above</li>
                              <li>Take a screenshot of the transfer confirmation / debit alert</li>
                              <li>Upload that screenshot here</li>
                            </ol>
                            <p className="text-[10px] text-muted-foreground/70 pt-1">Your screenshot is pinned to IPFS — it becomes the immutable proof the seller and any arbiter will review.</p>
                          </>
                        )}
                      </div>
                    )}

                    {trade.evidenceUrl ? (
                      <div className="rounded-xl border border-border overflow-hidden">
                        <img src={trade.evidenceUrl} alt="Bank receipt" className="w-full max-h-80 object-contain bg-background" />
                        <div className="p-3 flex items-center justify-between border-t border-border">
                          <span className="text-[10px] font-mono uppercase tracking-tighter text-muted-foreground">
                            {isDemo ? "Demo evidence submitted" : "Pinned at milestone"} · {new Date(trade.evidenceUploadedAt!).toLocaleString()}
                          </span>
                          {!isDemo && (
                            <a
                              href={trade.evidenceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline text-[10px] font-mono flex items-center gap-1"
                            >
                              IPFS <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    ) : effectiveIsBuyer ? (
                      <div
                        onClick={() => !uploadingEvidence && fileRef.current?.click()}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const f = e.dataTransfer.files?.[0];
                          if (f && !uploadingEvidence) handleFile(f);
                        }}
                        className={`border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center gap-3 transition cursor-pointer ${uploadingEvidence ? "opacity-60 cursor-not-allowed" : "hover:border-primary/50 hover:bg-card/40"}`}
                      >
                        {uploadingEvidence ? (
                          <Loader2 className="size-6 text-primary animate-spin" />
                        ) : (
                          <Upload className="size-6 text-muted-foreground" />
                        )}
                        <p className="text-xs text-muted-foreground text-center">
                          {uploadingEvidence
                            ? (isDemo ? "Processing…" : "Uploading to IPFS…")
                            : isDemo
                            ? <>Upload any image to test the flow</>
                            : <>Drop your bank transfer screenshot or <span className="text-primary">browse files</span></>
                          }
                        </p>
                        <p className="text-[10px] text-muted-foreground/60 font-mono">
                          {isDemo ? "JPG, PNG, GIF — any image" : "JPG or PNG · max 10MB"}
                        </p>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFile(f);
                          }}
                        />
                      </div>
                    ) : (
                      <div className="rounded-xl border border-border p-6 text-center text-sm text-muted-foreground">
                        Waiting for buyer to send fiat and upload receipt…
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {trade.status === "funded" && effectiveIsBuyer && !trade.evidenceUrl && (
                  <div className="pt-2">
                    <button
                      onClick={() => fileRef.current?.click()}
                      disabled={uploadingEvidence}
                      className="w-full px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {uploadingEvidence && <Loader2 className="size-4 animate-spin" />}
                      Submit Payment Evidence
                    </button>
                  </div>
                )}

                {trade.status === "funded" && !effectiveIsBuyer && (
                  <div className="pt-2">
                    <button
                      onClick={() => {
                        cancelTrade(trade.id);
                        toast("Trade cancelled · funds returned to seller");
                      }}
                      className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-bold hover:border-destructive/40 hover:text-destructive transition"
                    >
                      Cancel trade
                    </button>
                  </div>
                )}

                {trade.status === "paid" && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={handleDispute}
                      className="px-4 py-3 bg-secondary border border-border rounded-xl text-sm font-bold hover:border-destructive/40 hover:text-destructive transition inline-flex items-center justify-center gap-2"
                    >
                      <AlertTriangle className="size-4" /> Open Dispute
                    </button>
                    <button
                      onClick={handleApprove}
                      disabled={approvingRelease}
                      className="px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 transition shadow-[0_0_24px_rgba(16,185,129,0.35)] disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {approvingRelease && <Loader2 className="size-4 animate-spin" />}
                      {approvingRelease ? "Releasing…" : "Approve & Release"}
                    </button>
                  </div>
                )}

                {trade.status === "released" && (
                  <div className="p-5 rounded-xl bg-primary/10 border border-primary/30 text-center">
                    <Check className="size-8 mx-auto text-primary mb-2" />
                    <div className="font-bold">Trade settled on-chain</div>
                    <div className="text-xs text-muted-foreground font-mono mt-1">{fmtUsdc(trade.amountUsdc)} → {shortAddr(trade.buyerAddress)}</div>
                  </div>
                )}

                {trade.status === "disputed" && (
                  <div className="p-5 rounded-xl bg-destructive/10 border border-destructive/30 text-center">
                    <AlertTriangle className="size-8 mx-auto text-destructive mb-2" />
                    <div className="font-bold">Dispute open</div>
                    <div className="text-xs text-muted-foreground mt-1">A LocalP2P arbiter is reviewing the evidence. Estimated resolution: 24–48h.</div>
                    {trade.evidenceUrl && (
                      <a href={trade.evidenceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        View evidence <ExternalLink className="size-3" />
                      </a>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 justify-center text-[10px] text-muted-foreground uppercase tracking-tighter font-mono pt-2 border-t border-border">
                  <span className="size-1.5 rounded-full bg-primary" />
                  Soroban Escrow: {shortAddr(trade.escrowContract)} · tx {trade.txHash.slice(0, 10)}…
                  {trade.txHash && (
                    <a
                      href={stellar.getExplorerLink(trade.txHash, "tx")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline ml-1"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* Side: chat + counterparty */}
          <aside className="lg:col-span-4 space-y-6">
            <div className="p-5 rounded-2xl bg-card border border-border">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">Counterparty</p>
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-secondary ring-1 ring-border grid place-items-center text-sm font-bold text-primary">
                  {trade.sellerName.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-sm">{trade.sellerName}</div>
                  <div className="text-[10px] font-mono text-muted-foreground">{shortAddr(trade.sellerAddress)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-card border border-border flex flex-col h-[460px]">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Secure messenger</span>
                <span className="text-[10px] font-mono text-primary uppercase tracking-tighter inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full bg-primary" /> Online
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {trade.messages.map((m, i) => (
                  <div key={i} className={`flex ${m.from === role ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                      m.from === "system"
                        ? "bg-primary/10 text-primary font-mono uppercase tracking-tighter text-[10px] mx-auto text-center"
                        : m.from === role
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-foreground border border-border"
                    }`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                <div ref={chatEnd} />
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && draft.trim()) {
                      sendMessage(trade.id, role, draft.trim());
                      setDraft("");
                    }
                  }}
                  placeholder="Type a message…"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-primary"
                />
                <button
                  onClick={() => {
                    if (draft.trim()) {
                      sendMessage(trade.id, role, draft.trim());
                      setDraft("");
                    }
                  }}
                  className="px-3 bg-primary text-primary-foreground rounded-lg"
                >
                  <Send className="size-4" />
                </button>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function BankRow({ label, value, mono, onCopy }: { label: string; value: string; mono?: boolean; onCopy?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex items-center gap-2">
        <span className={`text-foreground ${mono ? "font-mono" : "font-medium"} text-sm`}>{value}</span>
        {onCopy && (
          <button onClick={onCopy} className="text-muted-foreground hover:text-primary">
            <Copy className="size-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
