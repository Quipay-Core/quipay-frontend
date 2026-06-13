/**
 * simulationUtils.ts — Stellar/Soroban fee estimation utilities.
 * Soroban fees are paid in XLM stroops and are very cheap (~100-300 stroops).
 */

export interface GasEstimate {
  gasUnits: bigint;
  gasPrice: bigint;
  totalFeeNative: bigint;
  feeDisplay: string;
}

export function estimateGas(): Promise<GasEstimate> {
  return Promise.resolve({
    gasUnits: 300n,
    gasPrice: 1n,
    totalFeeNative: 300n,
    feeDisplay: "< $0.000001",
  });
}

export function formatStroops(): string {
  return "use Soroban simulation";
}

export interface SimulationResult {
  success: boolean;
  error?: string;
  feeDisplay: string;
  gasUnits: bigint;
}

export interface TokenBalance {
  token: string;
  balance: string;
  symbol: string;
}
