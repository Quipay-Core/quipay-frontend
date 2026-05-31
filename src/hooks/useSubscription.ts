/**
 * useSubscription.ts — EVM event subscription for ARC.
 *
 * Replaces the Stellar/Soroban event polling with viem's watchContractEvent.
 * Consumers subscribe to PayrollStream events using the real ABI.
 */

import { useEffect, useRef } from "react";
import { createPublicClient, http, type Abi } from "viem";
import { arcTestnet } from "../contracts/util";
import { PAYROLL_STREAM_ABI } from "../contracts/abi/PayrollStream.abi";
import { PAYROLL_STREAM_ADDRESS } from "../contracts/payroll_stream";

type UnwatchFn = () => void;

/**
 * Subscribe to a named event on the PayrollStream contract.
 * The callback fires once per matching log.
 *
 * @param eventName  Name of the event (e.g. "StreamCreated", "Withdrawn")
 * @param onEvent    Callback receiving the decoded event args
 * @param enabled    Set to false to pause without unmounting
 */
export function useStreamEvent<TArgs = unknown>(
  eventName: string,
  onEvent: (args: TArgs) => void,
  enabled = true,
) {
  const unwatchRef = useRef<UnwatchFn | null>(null);

  useEffect(() => {
    if (!enabled || !PAYROLL_STREAM_ADDRESS || PAYROLL_STREAM_ADDRESS === "0x0000000000000000000000000000000000000000") {
      return;
    }

    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });

    try {
      unwatchRef.current = client.watchContractEvent({
        address: PAYROLL_STREAM_ADDRESS,
        abi: PAYROLL_STREAM_ABI as Abi,
        eventName: eventName as any,
        onLogs: (logs) => {
          for (const log of logs) {
            onEvent((log as any).args as TArgs);
          }
        },
      });
    } catch (e) {
      console.warn(`useStreamEvent(${eventName}): watch failed`, e);
    }

    return () => {
      unwatchRef.current?.();
      unwatchRef.current = null;
    };
  }, [eventName, onEvent, enabled]);
}
