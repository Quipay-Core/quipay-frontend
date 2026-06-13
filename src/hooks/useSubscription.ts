/**
 * useSubscription.ts — Stellar/Soroban event subscription.
 *
 * Soroban events are polled via rpc.Server.getEvents rather than websocket.
 * On testnet, real-time event streaming requires a backend relay; this hook
 * is a no-op stub — callers rely on the timer-based refetch in usePayroll/useStreams.
 */

import { useEffect, useRef } from "react";
import { PAYROLL_STREAM_ADDRESS } from "../contracts/payroll_stream";

/**
 * Subscribe to a named event on the PayrollStream contract.
 * Currently a polling stub — actual events come through refetch timers.
 */
export function useStreamEvent<TArgs = unknown>(
  _eventName: string,
  _onEvent: (args: TArgs) => void,
  enabled = true,
) {
  const enabledRef = useRef(enabled);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !PAYROLL_STREAM_ADDRESS?.startsWith("C")) return;
    // No-op: Soroban event streaming requires a backend relay on testnet.
    // usePayroll and useStreams poll via setFetchTick instead.
  }, [enabled]);
}
