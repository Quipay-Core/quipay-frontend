/**
 * useStreamSubscription — Stellar/Soroban version.
 * Subscribes to Withdrawn events on the PayrollStream contract.
 * On Stellar testnet, events are polled via rpc.getEvents.
 * The hook stays mounted but fires through the refetch mechanism in useStreams.
 */

import { useCallback, useEffect, useRef } from "react";
import { useStreamEvent } from "./useSubscription";
import { PAYROLL_STREAM_ADDRESS } from "../contracts/payroll_stream";
import { USDC_DECIMALS } from "../contracts/util";

const USDC_UNIT = 10 ** USDC_DECIMALS; // 10^7 for Stellar

export interface StreamWithdrawalUpdate {
  streamId: string;
  amount: number;
}

export function useStreamSubscription(
  onWithdrawal: (update: StreamWithdrawalUpdate) => void,
  refetch?: () => void,
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

  const enabled = Boolean(PAYROLL_STREAM_ADDRESS?.startsWith("C"));

  useStreamEvent<{ streamId?: bigint; worker?: string; amount?: bigint }>(
    "Withdrawn",
    handleWithdrawnEvent,
    enabled,
  );
}
