/**
 * withdrawFeeEstimate.ts — Soroban withdraw fee estimation.
 * Stellar fees are paid in XLM and are negligible (< $0.000001).
 */

import { PAYROLL_STREAM_ADDRESS } from "../contracts/payroll_stream";

export interface WithdrawFeeEstimate {
  feeDisplay: string;
  gasUnits: bigint;
  available: boolean;
}

export function isWithdrawFeeEstimateAvailable(): boolean {
  return Boolean(
    PAYROLL_STREAM_ADDRESS?.trim() && PAYROLL_STREAM_ADDRESS.startsWith("C"),
  );
}

export function estimateWithdrawFee(): Promise<WithdrawFeeEstimate> {
  return Promise.resolve({
    feeDisplay: "< $0.000001",
    gasUnits: 300n,
    available: isWithdrawFeeEstimateAvailable(),
  });
}
