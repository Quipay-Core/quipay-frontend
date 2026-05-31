/**
 * friendbot.ts — Faucet helper for ARC testnet.
 * Replaces Stellar Friendbot with Circle's USDC faucet.
 */

export const ARC_FAUCET_URL = "https://faucet.circle.com";

/**
 * Open the Circle faucet in a new tab to get testnet USDC.
 * There is no programmatic ARC faucet API — manual only.
 */
export function openFaucet(): void {
  window.open(ARC_FAUCET_URL, "_blank", "noopener,noreferrer");
}
