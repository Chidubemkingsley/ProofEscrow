/**
 * Stellar Helper — Blockchain logic via Stellar Wallets Kit
 * Supports: Freighter, xBull, Albedo, Rabet, Lobstr, Hana
 *
 * Uses allowAllModules() with lazy kit initialization to avoid
 * SSR crashes — the kit is only created in the browser.
 */
import * as StellarSdk from "@stellar/stellar-sdk";

export class StellarHelper {
  private server: StellarSdk.Horizon.Server;
  private networkPassphrase: string;
  private networkEnum: "testnet" | "mainnet";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _kit: any | null = null;
  private publicKey: string | null = null;

  constructor(network: "testnet" | "mainnet" = "testnet") {
    this.networkEnum = network;
    this.server = new StellarSdk.Horizon.Server(
      network === "testnet"
        ? "https://horizon-testnet.stellar.org"
        : "https://horizon.stellar.org"
    );
    this.networkPassphrase =
      network === "testnet"
        ? StellarSdk.Networks.TESTNET
        : StellarSdk.Networks.PUBLIC;
  }

  /**
   * Lazy-initialize the wallet kit — browser only, never on SSR.
   * Uses dynamic imports so wallet extension code never runs server-side.
   */
  private async getKit() {
    if (this._kit) return this._kit;

    const { StellarWalletsKit, WalletNetwork, allowAllModules, FREIGHTER_ID } =
      await import("@creit.tech/stellar-wallets-kit");

    const network =
      this.networkEnum === "testnet"
        ? WalletNetwork.TESTNET
        : WalletNetwork.PUBLIC;

    this._kit = new StellarWalletsKit({
      network,
      selectedWalletId: FREIGHTER_ID,
      modules: allowAllModules(),
    });

    return this._kit;
  }

  isFreighterInstalled(): boolean {
    return true;
  }

  /**
   * Opens the wallet selection modal and returns the connected public key.
   */
  async connectWallet(): Promise<string> {
    const kit = await this.getKit();

    await kit.openModal({
      onWalletSelected: async (option: { id: string }) => {
        console.log("Wallet selected:", option.id);
        kit.setWallet(option.id);
      },
    });

    const { address } = await kit.getAddress();
    if (!address) throw new Error("No address returned from wallet");
    this.publicKey = address;
    return address;
  }

  /**
   * Fetch XLM + all token balances for an address.
   */
  async getBalance(publicKey: string): Promise<{
    xlm: string;
    assets: Array<{ code: string; issuer: string; balance: string }>;
  }> {
    const account = await this.server.loadAccount(publicKey);
    const xlmBalance = account.balances.find((b) => b.asset_type === "native");
    const assets = account.balances
      .filter((b) => b.asset_type !== "native")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((b: any) => ({
        code: b.asset_code,
        issuer: b.asset_issuer,
        balance: b.balance,
      }));
    return {
      xlm: xlmBalance && "balance" in xlmBalance ? xlmBalance.balance : "0",
      assets,
    };
  }

  /**
   * Returns the USDC balance for an address (0 if no trustline).
   */
  async getUsdcBalance(publicKey: string): Promise<number> {
    try {
      const { assets } = await this.getBalance(publicKey);
      const usdc = assets.find((a) => a.code === "USDC");
      return usdc ? parseFloat(usdc.balance) : 0;
    } catch {
      return 0;
    }
  }

  /**
   * Sign an XDR transaction with the connected wallet.
   */
  async signTransaction(xdr: string): Promise<string> {
    const kit = await this.getKit();
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      networkPassphrase: this.networkPassphrase,
    });
    return signedTxXdr;
  }

  /**
   * Submit a signed XDR to the Stellar network.
   */
  async submitTransaction(
    signedXdr: string
  ): Promise<{ hash: string; success: boolean }> {
    const tx = StellarSdk.TransactionBuilder.fromXDR(
      signedXdr,
      this.networkPassphrase
    );
    const result = await this.server.submitTransaction(
      tx as StellarSdk.Transaction
    );
    return { hash: result.hash, success: result.successful };
  }

  /**
   * Returns a Stellar Expert explorer link for a tx or account.
   */
  getExplorerLink(hash: string, type: "tx" | "account" = "tx"): string {
    const net =
      this.networkPassphrase === StellarSdk.Networks.TESTNET
        ? "testnet"
        : "public";
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

export const stellar = new StellarHelper("testnet");
