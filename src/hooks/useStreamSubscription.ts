/**
 * useStreamSubscription — ARC version.
 * Subscribes to Withdrawn events on the PayrollStream contract via viem.
 * Replaces the Soroban/Horizon event polling version.
 */

import { useCallback, useEffect, useRef } from "react";
import { useStreamEvent } from "./useSubscription";
import { PAYROLL_STREAM_ADDRESS } from "../contracts/payroll_stream";
import { USDC_DECIMALS } from "../contracts/util";

/** ARC USDC uses 6 decimal places (NOT 7 like Stellar stroops). */
const USDC_UNIT = 10 ** USDC_DECIMALS;

export interface StreamWithdrawalUpdate {
  streamId: string;
  amount: number;
}

/**
 * Subscribe to `Withdrawn` events from the PayrollStream contract on ARC.
 * Calls `onWithdrawal` whenever a withdrawal event is detected.
 */
export function useStreamSubscription(
  onWithdrawal: (update: StreamWithdrawalUpdate) => void,
  refetch?: () => void,
  _pollInterval = 5000,
) {
  const onWithdrawalRef = useRef(onWithdrawal);
  const refetchRef = useRef(refetch);

  useEffect(() => {
    onWithdrawalRef.current = onWithdrawal;
    refetchRef.current = refetch;
  }, [onWithdrawal, refetch]);

  const handleWithdrawnEvent = useCallback(
    (args: { streamId?: bigint; worker?: string; amount?: bigint }) => {
      try {
        const streamId = String(args.streamId ?? 0n);
        const amount = Number(args.amount ?? 0n) / USDC_UNIT;
        onWithdrawalRef.current({ streamId, amount });
        refetchRef.current?.();
      } catch {
        // skip malformed events
      }
    },
    [],
  );

  const enabled = Boolean(
    PAYROLL_STREAM_ADDRESS &&
    PAYROLL_STREAM_ADDRESS !== "0x0000000000000000000000000000000000000000",
  );

  useStreamEvent<{ streamId?: bigint; worker?: string; amount?: bigint }>(
    "Withdrawn",
    handleWithdrawnEvent,
    enabled,
  );
}
