/**
 * simulationUtils.ts — ARC gas estimation utilities.
 *
 * Replaces the Soroban XDR simulation layer.
 * On ARC, gas is paid in USDC (18 decimals native) not XLM/stroops.
 *
 * For now, gas estimation is done via viem's estimateGas.
 * Use USDC amounts with 6 decimals for token values.
 */

import { createPublicClient, http, type TransactionRequest } from "viem";
import { arcTestnet } from "../contracts/util";

export interface GasEstimate {
  /** Estimated gas units */
  gasUnits: bigint;
  /** Gas price in wei (USDC 18-decimal native) */
  gasPrice: bigint;
  /** Estimated total fee in USDC-native (18 decimals) */
  totalFeeNative: bigint;
  /** Human-readable fee (very small — ARC fees are minimal) */
  feeDisplay: string;
}

export async function estimateGas(tx: TransactionRequest): Promise<GasEstimate> {
  const client = createPublicClient({ chain: arcTestnet, transport: http() });
  try {
    const [gasUnits, feeData] = await Promise.all([
      client.estimateGas(tx as any),
      client.estimateFeesPerGas(),
    ]);
    const gasPrice = feeData.maxFeePerGas ?? feeData.gasPrice ?? 0n;
    const totalFeeNative = gasUnits * gasPrice;
    const feeUsdc = Number(totalFeeNative) / 1e18;
    return {
      gasUnits,
      gasPrice,
      totalFeeNative,
      feeDisplay: feeUsdc < 0.000001 ? "< $0.000001" : `~$${feeUsdc.toFixed(8)}`,
    };
  } catch {
    return { gasUnits: 21000n, gasPrice: 0n, totalFeeNative: 0n, feeDisplay: "< $0.000001" };
  }
}

/** Backwards-compat: simulate was used for Soroban XDR building. On ARC use writeContract. */
export function formatStroops(_: number): string {
  return "use estimateGas()";
}

// Backwards compat stubs used by TransactionSimulationModal
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
