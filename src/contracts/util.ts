/**
 * Stellar / Soroban network configuration.
 *
 * Testnet RPC  : https://soroban-testnet.stellar.org
 * Horizon      : https://horizon-testnet.stellar.org
 * Network pass : Test SDF Network ; September 2015
 */

import { Networks } from "@stellar/stellar-sdk";

// ─── Network constants ────────────────────────────────────────────────────────

export const SOROBAN_RPC_URL =
  import.meta.env.VITE_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org";

export const HORIZON_URL =
  import.meta.env.VITE_HORIZON_URL ?? "https://horizon-testnet.stellar.org";

export const networkPassphrase: string = Networks.TESTNET;

/** @deprecated alias — use HORIZON_URL */
export const horizonUrl = HORIZON_URL;

export const network = {
  id: "stellar-testnet" as const,
  label: "Stellar Testnet",
  rpcUrl: SOROBAN_RPC_URL,
  explorerUrl: "https://stellar.expert/explorer/testnet",
  passphrase: networkPassphrase,
};

// ─── Contract IDs (from environments.toml) ───────────────────────────────────

export const PAYROLL_STREAM_CONTRACT_ID =
  import.meta.env.VITE_PAYROLL_STREAM_CONTRACT_ID ??
  "CAQ5IXSFW74FXUZ6M7OURK36JFEGTJ5NC5GITPRSZBSY2FWOTRVAGVPV";

export const PAYROLL_VAULT_CONTRACT_ID =
  import.meta.env.VITE_PAYROLL_VAULT_CONTRACT_ID ??
  "CCVIZ7256UFV2TKVTQ6ANU6S75IFFSXMLJOXOXW5QZOUXBTWDIRXGEUJ";

export const AUTOMATION_GATEWAY_CONTRACT_ID =
  import.meta.env.VITE_AUTOMATION_GATEWAY_CONTRACT_ID ??
  "CDYO5HXZ7K5XP2U52DW5PCYRTG6NVXDG525ZFYVRGOKD6BRERM44AVRO";

export const WORKFORCE_REGISTRY_CONTRACT_ID =
  import.meta.env.VITE_WORKFORCE_REGISTRY_CONTRACT_ID ??
  "CCAKBM7WW34SJGRG3J2OQANPKCEQ44MSRRSLKJQM6RKEMO3O5DNGPFXJ";

// USDC asset on Stellar testnet (Circle testnet issuer)
export const USDC_ISSUER =
  import.meta.env.VITE_USDC_ISSUER ??
  "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

export const USDC_ASSET_CODE = "USDC";

// ─── Amount helpers (7 decimal Stellar stroops) ───────────────────────────────

export const STROOPS_PER_UNIT = 10_000_000n; // 1 XLM or 1 USDC = 10^7 stroops
export const USDC_DECIMALS = 7;

/** Convert stroops (bigint) to human-readable string with dp decimal places. */
export function formatUsdc(stroops: bigint, dp = 2): string {
  if (stroops === 0n) return "0.00";
  const abs = stroops < 0n ? -stroops : stroops;
  const sign = stroops < 0n ? "-" : "";
  const whole = abs / STROOPS_PER_UNIT;
  const frac = (abs % STROOPS_PER_UNIT)
    .toString()
    .padStart(7, "0")
    .slice(0, dp);
  return `${sign}${whole}.${frac}`;
}

/** Parse a display string like "10.50" into stroops bigint. */
export function parseUsdc(display: string): bigint {
  const [whole = "0", frac = ""] = display.replace(/,/g, "").split(".");
  const fracPadded = frac.padEnd(7, "0").slice(0, 7);
  return BigInt(whole) * STROOPS_PER_UNIT + BigInt(fracPadded || "0");
}

export const labPrefix = () =>
  `https://laboratory.stellar.org/#txbuilder?network=test`;
