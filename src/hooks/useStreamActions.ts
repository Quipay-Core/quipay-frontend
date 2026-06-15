import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import toast from "react-hot-toast";
import type { Stream } from "./usePayroll";
import { useWallet } from "./useWallet";
import {
  buildExtendStreamTx,
  buildPauseStreamTx,
  buildResumeStreamTx,
  submitAndAwaitTx,
} from "../contracts/payroll_stream";
import { signTransaction } from "../util/wallet";
import { floatToUsdc } from "../contracts/payroll_stream";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export type StreamAction = "pause" | "resume" | "cancel";

export interface OptimisticStreamContext {
  previousStreams?: Stream[];
}

export const getOptimisticStatus = (action: StreamAction): Stream["status"] => {
  if (action === "pause") return "paused";
  if (action === "resume") return "active";
  return "cancelled";
};

export const applyOptimisticStreamAction = (
  streams: Stream[] | undefined,
  streamId: string,
  action: StreamAction,
): Stream[] =>
  (streams ?? []).map((stream) =>
    stream.id === streamId
      ? {
          ...stream,
          status: getOptimisticStatus(action),
          pendingAction: action,
        }
      : stream,
  );

export const clearOptimisticStreamAction = (
  streams: Stream[] | undefined,
  streamId: string,
): Stream[] =>
  (streams ?? []).map((stream) =>
    stream.id === streamId ? { ...stream, pendingAction: undefined } : stream,
  );

interface UseStreamActionOptions {
  employerAddress?: string;
  runAction: (stream: Stream, action: StreamAction) => Promise<void>;
  onLocalOptimisticUpdate?: (
    streamId: string,
    status: Stream["status"],
    action: StreamAction,
  ) => void;
  onLocalRollback?: (stream: Stream) => void;
  onLocalSettled?: (streamId: string) => void;
}

export function useStreamActionMutation({
  employerAddress,
  runAction,
  onLocalOptimisticUpdate,
  onLocalRollback,
  onLocalSettled,
}: UseStreamActionOptions) {
  const queryClient = useQueryClient();
  const queryKey = ["payroll-streams", employerAddress] as const;

  return useMutation<
    void,
    Error,
    { stream: Stream; action: StreamAction },
    OptimisticStreamContext
  >({
    mutationFn: ({ stream, action }) => runAction(stream, action),
    onMutate: async ({ stream, action }) => {
      await queryClient.cancelQueries({ queryKey });
      const previousStreams = queryClient.getQueryData<Stream[]>(queryKey);
      queryClient.setQueryData<Stream[]>(
        queryKey,
        applyOptimisticStreamAction(previousStreams, stream.id, action),
      );
      onLocalOptimisticUpdate?.(stream.id, getOptimisticStatus(action), action);
      return { previousStreams };
    },
    onError: (error, { stream }, context) => {
      if (context?.previousStreams) {
        queryClient.setQueryData(queryKey, context.previousStreams);
      }
      onLocalRollback?.(stream);
      toast.error(
        `Failed to update stream ${stream.id}: ${error.message || "transaction failed"}`,
      );
    },
    onSettled: (_data, _error, { stream }) => {
      queryClient.setQueryData<Stream[]>(
        queryKey,
        clearOptimisticStreamAction(
          queryClient.getQueryData<Stream[]>(queryKey),
          stream.id,
        ),
      );
      onLocalSettled?.(stream.id);
      void queryClient.invalidateQueries({ queryKey });
    },
  });
}

// ─── Extend stream hook ──────────────────────────────────────────────────────

interface ExtendParams {
  additionalAmount?: string; // stroops
  newEndTime?: number; // unix seconds
  newRate?: string; // stroops/sec
}

/**
 * Hook for extending/topping up a stream.
 * Builds on-chain tx, signs with wallet, submits, then syncs backend DB.
 */
export function useExtendStream() {
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const extendStream = useCallback(
    async (streamId: number, params: ExtendParams) => {
      if (!address) return null;
      setIsLoading(true);
      setError(null);

      try {
        // Calculate parameters for the contract call
        const additionalAmount = params.additionalAmount
          ? BigInt(params.additionalAmount)
          : 0n;
        const newEndTime = params.newEndTime
          ? BigInt(params.newEndTime)
          : 0n;

        // If newRate is provided, calculate the required additional amount
        // This is done server-side in the backend, but for on-chain we need
        // the actual values. For now, pass through the direct params.

        // Step 1: Build on-chain transaction
        const { preparedXdr } = await buildExtendStreamTx(
          address,
          BigInt(streamId),
          additionalAmount,
          newEndTime,
        );

        // Step 2: Sign with wallet
        const { signedTxXdr } = await signTransaction(preparedXdr);

        // Step 3: Submit and wait for confirmation
        const txHash = await submitAndAwaitTx(signedTxXdr);

        // Step 4: Sync with backend DB
        await fetch(`${API_BASE}/streams/${streamId}/extend`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": address,
            "x-user-role": "user",
          },
          body: JSON.stringify({
            ...params,
            txHash,
            confirmed: true,
          }),
        }).catch(() => {
          // Backend sync failed, but on-chain tx succeeded
          // The syncer will pick it up eventually
        });

        void queryClient.invalidateQueries({ queryKey: ["payroll-streams"] });
        toast.success("Stream extended successfully");
        return { txHash };
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Failed to extend stream";
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [address, queryClient],
  );

  return { extendStream, isLoading, error };
}

/**
 * Hook for pausing a stream via on-chain transaction.
 */
export function usePauseStream() {
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pauseStream = useCallback(
    async (streamId: number) => {
      if (!address) return null;
      setIsLoading(true);
      setError(null);

      try {
        const { preparedXdr } = await buildPauseStreamTx(address, BigInt(streamId));
        const { signedTxXdr } = await signTransaction(preparedXdr);
        const txHash = await submitAndAwaitTx(signedTxXdr);

        // Sync with backend
        await fetch(`${API_BASE}/streams/${streamId}/pause`, {
          method: "POST",
          headers: { "x-user-id": address, "x-user-role": "user" },
        }).catch(() => {});

        void queryClient.invalidateQueries({ queryKey: ["payroll-streams"] });
        toast.success("Stream paused");
        return { txHash };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to pause stream";
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [address, queryClient],
  );

  return { pauseStream, isLoading, error };
}

/**
 * Hook for resuming a stream via on-chain transaction.
 */
export function useResumeStream() {
  const { address } = useWallet();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resumeStream = useCallback(
    async (streamId: number) => {
      if (!address) return null;
      setIsLoading(true);
      setError(null);

      try {
        const { preparedXdr } = await buildResumeStreamTx(address, BigInt(streamId));
        const { signedTxXdr } = await signTransaction(preparedXdr);
        const txHash = await submitAndAwaitTx(signedTxXdr);

        // Sync with backend
        await fetch(`${API_BASE}/streams/${streamId}/resume`, {
          method: "POST",
          headers: { "x-user-id": address, "x-user-role": "user" },
        }).catch(() => {});

        void queryClient.invalidateQueries({ queryKey: ["payroll-streams"] });
        toast.success("Stream resumed");
        return { txHash };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to resume stream";
        setError(msg);
        toast.error(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [address, queryClient],
  );

  return { resumeStream, isLoading, error };
}
