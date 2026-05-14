/**
 * Bank / payment provider lists per currency.
 * NGN — Nigerian banks + mobile money
 * GHS — Ghanaian banks + mobile money
 * KES — Kenyan banks + mobile money
 */

export type Currency = "NGN" | "GHS" | "KES";

export interface Bank {
  name: string;
  type: "bank" | "mobile";
}

export const BANKS: Record<Currency, Bank[]> = {
  NGN: [
    // Mobile money / fintech (most popular for P2P)
    { name: "OPay", type: "mobile" },
    { name: "Kuda Bank", type: "mobile" },
    { name: "PalmPay", type: "mobile" },
    { name: "Moniepoint", type: "mobile" },
    { name: "Carbon (Paylater)", type: "mobile" },
    { name: "Chipper Cash", type: "mobile" },
    // Commercial banks
    { name: "Access Bank", type: "bank" },
    { name: "GTBank (Guaranty Trust)", type: "bank" },
    { name: "Zenith Bank", type: "bank" },
    { name: "First Bank of Nigeria", type: "bank" },
    { name: "UBA (United Bank for Africa)", type: "bank" },
    { name: "Fidelity Bank", type: "bank" },
    { name: "Sterling Bank", type: "bank" },
    { name: "Stanbic IBTC Bank", type: "bank" },
    { name: "Union Bank", type: "bank" },
    { name: "Wema Bank (ALAT)", type: "bank" },
    { name: "Polaris Bank", type: "bank" },
    { name: "Keystone Bank", type: "bank" },
    { name: "Ecobank Nigeria", type: "bank" },
    { name: "FCMB (First City Monument Bank)", type: "bank" },
    { name: "Jaiz Bank", type: "bank" },
    { name: "Heritage Bank", type: "bank" },
    { name: "Providus Bank", type: "bank" },
    { name: "Titan Trust Bank", type: "bank" },
  ],
  GHS: [
    // Mobile money (dominant in Ghana)
    { name: "MTN Mobile Money (MoMo)", type: "mobile" },
    { name: "Vodafone Cash", type: "mobile" },
    { name: "AirtelTigo Money", type: "mobile" },
    { name: "Zeepay", type: "mobile" },
    // Banks
    { name: "GCB Bank", type: "bank" },
    { name: "Ecobank Ghana", type: "bank" },
    { name: "Absa Bank Ghana", type: "bank" },
    { name: "Stanbic Bank Ghana", type: "bank" },
    { name: "Standard Chartered Ghana", type: "bank" },
    { name: "Fidelity Bank Ghana", type: "bank" },
    { name: "CalBank", type: "bank" },
    { name: "Access Bank Ghana", type: "bank" },
    { name: "Republic Bank Ghana", type: "bank" },
    { name: "Agricultural Development Bank (ADB)", type: "bank" },
  ],
  KES: [
    // Mobile money (dominant in Kenya)
    { name: "M-Pesa (Safaricom)", type: "mobile" },
    { name: "Airtel Money", type: "mobile" },
    { name: "T-Kash (Telkom)", type: "mobile" },
    // Banks
    { name: "Equity Bank", type: "bank" },
    { name: "KCB (Kenya Commercial Bank)", type: "bank" },
    { name: "Co-operative Bank", type: "bank" },
    { name: "Absa Bank Kenya", type: "bank" },
    { name: "Standard Chartered Kenya", type: "bank" },
    { name: "NCBA Bank", type: "bank" },
    { name: "DTB (Diamond Trust Bank)", type: "bank" },
    { name: "I&M Bank", type: "bank" },
    { name: "Family Bank", type: "bank" },
    { name: "Stanbic Bank Kenya", type: "bank" },
    { name: "Prime Bank Kenya", type: "bank" },
  ],
};

/** Returns a flat list of bank names for a given currency. */
export function getBankNames(currency: Currency): string[] {
  return BANKS[currency].map((b) => b.name);
}
