/**
 * withdrawFeeEstimate.ts — ARC gas estimation for withdraw transactions.
 * Replaces the Soroban XDR simulation version.
 * On ARC, gas fees are minimal (USDC-denominated, effectively < $0.000001).
 */

import { PAYROLL_STREAM_ADDRESS } from "../contracts/payroll_stream";
import { PAYROLL_STREAM_ABI } from "../contracts/abi/PayrollStream.abi";
import { estimateGas } from "./simulationUtils";

export interface WithdrawFeeEstimate {
  feeDisplay: string;
  gasUnits: bigint;
  available: boolean;
}

export function isWithdrawFeeEstimateAvailable(): boolean {
  return Boolean(
    PAYROLL_STREAM_ADDRESS?.trim() &&
    PAYROLL_STREAM_ADDRESS !== "0x0000000000000000000000000000000000000000"
  );
}

/**
 * Estimate the gas cost for a withdraw() call on PayrollStream.
 * On ARC, fees are paid in USDC and are negligible.
 */
export async function estimateWithdrawFee(
  callerAddress: `0x${string}`,
  streamId: bigint,
): Promise<WithdrawFeeEstimate> {
  if (!isWithdrawFeeEstimateAvailable()) {
    return { feeDisplay: "< $0.000001", gasUnits: 21000n, available: false };
  }
  try {
    const { encodeFunctionData } = await import("viem");
    const data = encodeFunctionData({
      abi: PAYROLL_STREAM_ABI,
      functionName: "withdraw",
      args: [streamId],
    });
    const estimate = await estimateGas({
      to: PAYROLL_STREAM_ADDRESS,
      from: callerAddress,
      data,
    });
    return { feeDisplay: estimate.feeDisplay, gasUnits: estimate.gasUnits, available: true };
  } catch {
    return { feeDisplay: "< $0.000001", gasUnits: 60000n, available: true };
  }
}
