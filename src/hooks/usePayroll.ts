import { useState, useEffect, useCallback, useMemo } from "react";
import { io } from "socket.io-client";
import {
  getAllVaultData,
  type TokenVaultData,
} from "../contracts/payroll_vault";
import {
  getStreamsByEmployer,
  getTokenSymbol,
  ContractStream,
} from "../contracts/payroll_stream";
import { USDC_ISSUER } from "../contracts/util";

type CacheEntry<T> = {
  promise: Promise<T>;
  timestamp: number;
};

const requestCache = new Map<string, CacheEntry<unknown>>();
const TTL = 2000;

async function dedupRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const existing = requestCache.get(key);

  if (existing && now - existing.timestamp < TTL) {
    return existing.promise as Promise<T>;
  }

  const promise = fn();
  requestCache.set(key, { promise, timestamp: now });

  try {
    const result = await promise;
    return result;
  } catch (err) {
    requestCache.delete(key);
    throw err;
  }
}

// Stellar USDC: 7 decimal places (10^7 stroops = 1 USDC)
const USDC_DIVISOR = 1e7;

export interface Stream {
  id: string;
  employeeName: string;
  employeeAddress: string;
  flowRate: string;
  tokenSymbol: string;
  startDate: string;
  endDate: string;
  totalAmount: string;
  totalStreamed: string;
  status: "active" | "paused" | "completed" | "cancelled";
  pendingAction?: "pause" | "resume" | "cancel";
}

export interface TokenBalance {
  tokenSymbol: string;
  balance: string;
}

export interface PayrollSummary {
  total_disbursed: string;
  avg_payment: string;
  cost_by_department: Array<{
    dept: string;
    total: string;
  }>;
  headcount: number;
  streams_active: number;
}

const DEFAULT_TOKENS = [
  { token: USDC_ISSUER, tokenSymbol: "USDC", monthlyBurnRate: BigInt(0) },
];

export const usePayroll = (
  employerAddress: string | undefined,
  options?: {
    offset?: number;
    limit?: number;
  },
) => {
  const [treasuryBalances, setTreasuryBalances] = useState<TokenBalance[]>([]);
  const [totalLiabilities, setTotalLiabilities] = useState<string>("0");
  const [streams, setStreams] = useState<Stream[]>([]);
  const [vaultData, setVaultData] = useState<TokenVaultData[]>([]);
  const [payrollSummary, setPayrollSummary] = useState<PayrollSummary | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isVaultLoading, setIsVaultLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [payrollSummaryError, setPayrollSummaryError] = useState<string | null>(
    null,
  );
  const [fetchTick, setFetchTick] = useState(0);

  const fetchVaultData = useCallback(async () => {
    setIsVaultLoading(true);
    try {
      const data = await dedupRequest("vaultData", () =>
        getAllVaultData(DEFAULT_TOKENS, employerAddress ?? ""),
      );

      setVaultData(data);
      setTreasuryBalances(
        data.map((v: TokenVaultData) => ({
          tokenSymbol: v.tokenSymbol,
          balance: v.balance.toString(),
        })),
      );

      const totalLiability = data.reduce(
        (sum: bigint, v: TokenVaultData) => sum + v.liability,
        BigInt(0),
      );
      setTotalLiabilities(totalLiability.toString());
    } catch (error) {
      console.error("Failed to fetch vault data:", error);
      setVaultData([]);
    } finally {
      setIsVaultLoading(false);
    }
  }, [employerAddress]);

  const fetchPayrollSummary = useCallback(async (address: string) => {
    const backendUrl = import.meta.env.PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      setPayrollSummary(null);
      setPayrollSummaryError(null);
      return;
    }

    try {
      await dedupRequest(`summary-${address}`, async () => {
        const response = await fetch(
          `${backendUrl}/api/v1/analytics/payroll-summary?org_id=${encodeURIComponent(address)}&period=ytd`,
        );

        if (!response.ok) throw new Error("Failed to load payroll summary");

        const payload = await response.json();
        setPayrollSummary(payload.data ?? null);
      });
      setPayrollSummaryError(null);
    } catch (err) {
      console.error("Failed to fetch payroll summary:", err);
      setPayrollSummaryError(
        err instanceof Error
          ? err.message
          : "Failed to load payroll summary. Please retry.",
      );
    }
  }, []);

  const retryPayrollSummary = useCallback(async () => {
    if (!employerAddress) return;
    await fetchPayrollSummary(employerAddress);
  }, [employerAddress, fetchPayrollSummary]);

  const fetchStreams = useCallback(
    async (address: string) => {
      try {
        const streamPage = await dedupRequest(
          `streams-${address}-${options?.offset}-${options?.limit}`,
          () => getStreamsByEmployer(address, options?.offset, options?.limit),
        );

        const employerStreams: Stream[] = await Promise.all(
          streamPage.streams.map(async (s: ContractStream, index: number) => {
            const streamId = String((options?.offset ?? 0) + index + 1);
            const tokenSymbol = await getTokenSymbol(address, s.token);

            const durationSecs = Number(s.endTs) - Number(s.startTs);
            const ratePerSec =
              durationSecs > 0
                ? Number(s.totalAmount) / USDC_DIVISOR / durationSecs
                : 0;

            const fmtDate = (ts: bigint) =>
              ts > 0n
                ? new Date(Number(ts) * 1000).toISOString().split("T")[0]
                : "—";

            return {
              id: streamId,
              employeeName: `${s.worker.slice(0, 6)}…${s.worker.slice(-4)}`,
              employeeAddress: s.worker,
              flowRate: ratePerSec.toFixed(7),
              tokenSymbol,
              startDate: fmtDate(s.startTs),
              endDate: fmtDate(s.endTs),
              totalAmount: (Number(s.totalAmount) / USDC_DIVISOR).toFixed(2),
              totalStreamed: (Number(s.withdrawnAmount) / USDC_DIVISOR).toFixed(
                2,
              ),
              // StreamStatus: Active=0, PendingCancel=1, Cancelled=2, Completed=3, Paused=4
              status:
                s.status === 2
                  ? "cancelled"
                  : s.status === 3
                    ? "completed"
                    : s.status === 4
                      ? "paused"
                      : "active",
            };
          }),
        );

        setStreams(employerStreams);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load stream data",
        );
        setStreams([]);
      }
    },
    [options],
  );

  const refetch = useCallback(() => {
    setFetchTick((t) => t + 1);
  }, []);

  const applyOptimisticStreamStatus = useCallback(
    (
      streamId: string,
      status: Stream["status"],
      action: "pause" | "resume" | "cancel",
    ) => {
      setStreams((prev) =>
        prev.map((stream) =>
          stream.id === streamId
            ? { ...stream, status, pendingAction: action }
            : stream,
        ),
      );
    },
    [],
  );

  const restoreStream = useCallback((snapshot: Stream) => {
    setStreams((prev) =>
      prev.map((stream) =>
        stream.id === snapshot.id
          ? { ...snapshot, pendingAction: undefined }
          : stream,
      ),
    );
  }, []);

  const clearStreamPending = useCallback((streamId: string) => {
    setStreams((prev) =>
      prev.map((stream) =>
        stream.id === streamId
          ? { ...stream, pendingAction: undefined }
          : stream,
      ),
    );
  }, []);

  const refreshData = useCallback(async () => {
    await fetchVaultData();
    if (employerAddress) {
      await Promise.all([
        fetchStreams(employerAddress),
        fetchPayrollSummary(employerAddress),
      ]);
    }
  }, [employerAddress, fetchPayrollSummary, fetchStreams, fetchVaultData]);

  useEffect(() => {
    const WS_URL = import.meta.env.PUBLIC_BACKEND_URL;
    if (!employerAddress || !WS_URL) return;

    const socket = io(WS_URL, {
      path: "/socket.io",
      query: { token: localStorage.getItem("auth_token") || "dummy" },
    });

    socket.on("stream:event", () => {
      refetch();
    });

    return () => {
      socket.disconnect();
    };
  }, [employerAddress, refetch]);

  useEffect(() => {
    if (!employerAddress) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreams([]);

      setPayrollSummary(null);

      setIsLoading(false);

      setError(null);

      setPayrollSummaryError(null);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        await fetchVaultData();
        await Promise.all([
          fetchStreams(employerAddress),
          fetchPayrollSummary(employerAddress),
        ]);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load payroll data",
        );
        setStreams([]);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [
    employerAddress,
    fetchPayrollSummary,
    fetchStreams,
    fetchTick,
    fetchVaultData,
  ]);

  const activeStreams = useMemo(
    () =>
      streams.filter(
        (s) =>
          s.status === "active" ||
          s.status === "paused" ||
          s.pendingAction !== undefined,
      ),
    [streams],
  );

  const activeStreamsCount = useMemo(
    () => streams.filter((s) => s.status === "active").length,
    [streams],
  );

  return {
    treasuryBalances,
    totalLiabilities,
    payrollSummary,
    payrollSummaryError,
    activeStreamsCount,
    streams,
    activeStreams,
    vaultData,
    isLoading,
    isVaultLoading,
    error,
    refreshData,
    refreshVaultData: fetchVaultData,
    refetch,
    retryPayrollSummary,
    applyOptimisticStreamStatus,
    restoreStream,
    clearStreamPending,
  };
};
