/**
 * Live USDC/fiat exchange rates.
 * Uses the free ExchangeRate-API (no key needed for USD base).
 * Falls back to hardcoded rates if the fetch fails.
 */

export type Currency = "NGN" | "GHS" | "KES";

const FALLBACK: Record<Currency, number> = {
  NGN: 1645.5,
  GHS: 15.42,
  KES: 129.1,
};

let _cache: { rates: Record<Currency, number>; fetchedAt: number } | null = null;
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

/**
 * Fetch live USD → NGN/GHS/KES rates.
 * USDC ≈ USD so we treat 1 USDC = 1 USD for rate purposes.
 */
export async function getLiveRates(): Promise<Record<Currency, number>> {
  if (_cache && Date.now() - _cache.fetchedAt < CACHE_TTL) {
    return _cache.rates;
  }

  try {
    // Free tier — no API key required, 1500 req/month
    const res = await fetch(
      "https://api.exchangerate-api.com/v4/latest/USD",
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) throw new Error("Rate fetch failed");
    const data = await res.json();
    const rates: Record<Currency, number> = {
      NGN: parseFloat(data.rates.NGN?.toFixed(2)) || FALLBACK.NGN,
      GHS: parseFloat(data.rates.GHS?.toFixed(2)) || FALLBACK.GHS,
      KES: parseFloat(data.rates.KES?.toFixed(2)) || FALLBACK.KES,
    };
    _cache = { rates, fetchedAt: Date.now() };
    return rates;
  } catch {
    return FALLBACK;
  }
}

/** Synchronous getter — returns cache or fallback (never throws). */
export function getRates(): Record<Currency, number> {
  return _cache?.rates ?? FALLBACK;
}
