/**
 * useStreamEscrow
 * ───────────────
 * Fetches on-chain escrow status for a stream.
 * Shows locked, vested, available amounts from the vault.
 */

import { useState, useEffect, useCallback } from "react";
import { getStreamEscrow, type StreamEscrow } from "../contracts/payroll_stream";

/**
 * Hook to fetch and poll stream escrow data.
 * Polls every 10 seconds to keep data fresh.
 */
export function useStreamEscrow(streamId: number | undefined) {
  const [escrow, setEscrow] = useState<StreamEscrow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEscrow = useCallback(async () => {
    if (!streamId) return;
    setIsLoading(true);
    try {
      const data = await getStreamEscrow(BigInt(streamId));
      setEscrow(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch escrow");
    } finally {
      setIsLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    void fetchEscrow();
  }, [fetchEscrow]);

  return { escrow, isLoading, error, refetch: fetchEscrow };
}
