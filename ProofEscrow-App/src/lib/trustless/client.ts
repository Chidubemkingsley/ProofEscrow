/**
 * Trustless Work API client — corrected against live Swagger spec
 * Base: https://dev.api.trustlesswork.com  (testnet)
 *
 * IMPORTANT: Every write endpoint returns { unsignedTransaction: string }
 * You must sign that XDR with the correct role wallet, then POST the
 * signedXdr to /helper/send-transaction to actually execute on-chain.
 *
 * Auth header: x-api-key  (NOT Bearer)
 */

const BASE = "https://dev.api.trustlesswork.com";

// USDC trustline on Stellar testnet
export const USDC_TRUSTLINE = {
  symbol: "USDC",
  address: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
};

function getHeaders() {
  return {
    "Content-Type": "application/json",
    "x-api-key": import.meta.env.VITE_TRUSTLESS_API_KEY ?? "",
  };
}

async function handleResponse<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Trustless Work API error (${res.status}): ${text}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON response: ${text}`);
  }
}

// ── Response types ────────────────────────────────────────────────────────────

export interface UnsignedTxResponse {
  status: "SUCCESS" | "FAILED";
  unsignedTransaction: string;
}

export interface SendTxResponse {
  status: "SUCCESS" | "FAILED";
  message: string;
  contractId?: string;
  escrow?: Record<string, unknown>;
}

export interface DeployEscrowParams {
  signer: string;          // seller — signs the deploy tx
  engagementId: string;    // unique ID for this trade
  title: string;
  description: string;
  roles: {
    approver: string;        // seller — approves milestone
    serviceProvider: string; // buyer — submits evidence
    platformAddress: string; // platform
    releaseSigner: string;   // platform — triggers release
    disputeResolver: string; // platform — resolves disputes
    receiver: string;        // buyer — receives USDC
  };
  amount: number;
  platformFee: number;       // percentage e.g. 1 = 1%
  milestones: Array<{ description: string }>;
  trustline: { symbol: string; address: string };
}

// ── API methods ───────────────────────────────────────────────────────────────

export const trustless = {
  /**
   * Step 1 of deploy: get unsigned XDR.
   * Caller must sign with seller wallet, then call sendTransaction().
   */
  deployEscrow: (params: DeployEscrowParams) =>
    fetch(`${BASE}/deployer/single-release`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(params),
    }).then((r) => handleResponse<UnsignedTxResponse>(r)),

  /**
   * Step 1 of fund: get unsigned XDR.
   * Caller must sign with seller wallet (signer), then call sendTransaction().
   */
  fundEscrow: (contractId: string, signer: string, amount: number) =>
    fetch(`${BASE}/escrow/single-release/fund-escrow`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ contractId, signer, amount }),
    }).then((r) => handleResponse<UnsignedTxResponse>(r)),

  /**
   * Step 1 of milestone status update (buyer submits evidence).
   * serviceProvider = buyer address.
   * Caller must sign with buyer wallet, then call sendTransaction().
   */
  changeMilestoneStatus: (
    contractId: string,
    serviceProvider: string,
    evidenceUrl: string,
    milestoneIndex = "0"
  ) =>
    fetch(`${BASE}/escrow/single-release/change-milestone-status`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        contractId,
        milestoneIndex,
        newEvidence: evidenceUrl,
        newStatus: "Completed",
        serviceProvider,
      }),
    }).then((r) => handleResponse<UnsignedTxResponse>(r)),

  /**
   * Step 1 of approve: get unsigned XDR.
   * approver = seller address.
   * Caller must sign with seller wallet, then call sendTransaction().
   */
  approveMilestone: (contractId: string, approver: string, milestoneIndex = "0") =>
    fetch(`${BASE}/escrow/single-release/approve-milestone`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ contractId, milestoneIndex, approver }),
    }).then((r) => handleResponse<UnsignedTxResponse>(r)),

  /**
   * Step 1 of release: get unsigned XDR.
   * releaseSigner = platform address.
   * Caller must sign with platform wallet, then call sendTransaction().
   * NOTE: For MVP the platform signs client-side using VITE_PLATFORM_SECRET.
   */
  releaseFunds: (contractId: string, releaseSigner: string) =>
    fetch(`${BASE}/escrow/single-release/release-funds`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ contractId, releaseSigner }),
    }).then((r) => handleResponse<UnsignedTxResponse>(r)),

  /**
   * Step 1 of dispute: get unsigned XDR.
   * signer = buyer or seller address (either can raise a dispute).
   * Caller must sign with their wallet, then call sendTransaction().
   */
  disputeEscrow: (contractId: string, signer: string) =>
    fetch(`${BASE}/escrow/single-release/dispute-escrow`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ contractId, signer }),
    }).then((r) => handleResponse<UnsignedTxResponse>(r)),

  /**
   * Final step for ALL write operations.
   * Submit the wallet-signed XDR to execute on Stellar.
   */
  sendTransaction: (signedXdr: string) =>
    fetch(`${BASE}/helper/send-transaction`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ signedXdr }),
    }).then((r) => handleResponse<SendTxResponse>(r)),

  /**
   * Fetch escrows where a wallet is the signer (seller's offers).
   */
  getEscrowsBySigner: (signer: string) =>
    fetch(
      `${BASE}/helper/get-escrows-by-signer?signer=${encodeURIComponent(signer)}&type=single-release`,
      { headers: getHeaders() }
    ).then((r) => handleResponse<unknown[]>(r)),

  /**
   * Fetch escrows by role (e.g. buyer as serviceProvider).
   */
  getEscrowsByRole: (role: string, roleAddress: string) =>
    fetch(
      `${BASE}/helper/get-escrows-by-role?role=${role}&roleAddress=${encodeURIComponent(roleAddress)}&type=single-release`,
      { headers: getHeaders() }
    ).then((r) => handleResponse<unknown[]>(r)),
};
