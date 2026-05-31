/**
 * ARC chain configuration for viem + wagmi.
 *
 * Chain ID:  5042002
 * RPC:       https://rpc.testnet.arc.network
 * Explorer:  https://testnet.arcscan.app
 * Gas token: USDC (18 decimals native / 6 decimals ERC-20)
 */

import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
});

/**
 * USDC ERC-20 contract on ARC testnet.
 * Uses 6 decimals (NOT 18 like the native gas interface).
 */
export const ARC_USDC_ADDRESS =
  "0x3600000000000000000000000000000000000000" as const;

/**
 * USDC decimal places for the ERC-20 interface.
 * 6 — same as Circle USDC on all EVM chains.
 * NOT 7 like Stellar stroops.
 */
export const USDC_DECIMALS = 6;

/** Convert a raw 6-decimal USDC bigint to a display string. */
export function formatUsdc(amount: bigint, dp = 2): string {
  const divisor = 10n ** BigInt(USDC_DECIMALS);
  const whole = amount / divisor;
  const frac = (amount % divisor).toString().padStart(USDC_DECIMALS, "0").slice(0, dp);
  return `${whole}.${frac}`;
}

/** Parse a display string like "10.50" into 6-decimal USDC bigint. */
export function parseUsdc(display: string): bigint {
  const [whole = "0", frac = ""] = display.replace(/,/g, "").split(".");
  const fracPadded = frac.padEnd(USDC_DECIMALS, "0").slice(0, USDC_DECIMALS);
  return BigInt(whole) * 10n ** BigInt(USDC_DECIMALS) + BigInt(fracPadded);
}

export const rpcUrl = arcTestnet.rpcUrls.default.http[0];

export const network = {
  id: "arc-testnet" as const,
  label: "Arc Testnet",
  chainId: arcTestnet.id,
  rpcUrl,
  explorerUrl: arcTestnet.blockExplorers.default.url,
};

// Backwards compat: old code imports networkPassphrase from here
export const networkPassphrase = String(arcTestnet.id);

// Backwards compat: old code imported horizonUrl from util
export const horizonUrl = arcTestnet.blockExplorers.default.url;

// Backwards compat: debug components used labPrefix for Stellar Lab links
export const labPrefix = () =>
  `https://testnet.arcscan.app`;
