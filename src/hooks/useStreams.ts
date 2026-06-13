import { useState, useEffect, useCallback } from "react";
import {
  getStreamsByWorker,
  getStreamById,
  getTokenSymbol,
  getWorkerWithdrawalEvents,
  ContractStream,
} from "../contracts/payroll_stream";
import { getCache, setCache } from "../services/offlineService";

export interface WorkerStream {
  id: string;
  employerName: string;
  employerAddress: string;
  flowRate: number;
  tokenSymbol: string;
  startTime: number;
  endTime: number;
  cliffTime: number;
  totalAmount: number;
  claimedAmount: number;
  status: number;
  proofCid?: string;
  proofGatewayUrl?: string;
}

export interface WithdrawalRecord {
  id: string;
  streamId: string;
  amount: string;
  tokenSymbol: string;
  date: string;
  txHash: string;
}

// Stellar USDC: 7 decimal places (10^7 stroops = 1 USDC)
const USDC_UNIT = 1e7;

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, "");
const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

const _employerNameCache = new Map<string, string>();

async function resolveEmployerName(address: string): Promise<string> {
  if (_employerNameCache.has(address)) {
    return _employerNameCache.get(address)!;
  }
  try {
    const res = await fetch(
      `${API_BASE}/api/employers/by-address?address=${encodeURIComponent(address)}`,
    );
    const data = (await res.json()) as {
      employer: { business_name: string } | null;
    };
    const name = data.employer?.business_name ?? address;
    _employerNameCache.set(address, name);
    return name;
  } catch {
    return address;
  }
}

const fetchProof = async (
  streamId: string,
): Promise<{ cid: string; gatewayUrl: string } | null> => {
  if (!BACKEND_URL) return null;
  try {
    const res = await fetch(`${BACKEND_URL}/proofs/${streamId}`);
    if (!res.ok) return null;
    return (await res.json()) as { cid: string; gatewayUrl: string };
  } catch {
    return null;
  }
};

export const useStreams = (workerAddress: string | undefined) => {
  const [streams, setStreams] = useState<WorkerStream[]>([]);
  const [withdrawalHistory, setWithdrawalHistory] = useState<
    WithdrawalRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => {
    setFetchTick((t) => t + 1);
  }, []);

  useEffect(() => {
    if (!workerAddress) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStreams([]);

      setWithdrawalHistory([]);

      setIsLoading(false);

      setError(null);
      return;
    }

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const streamIds = await getStreamsByWorker(workerAddress);

        const streamResults = await Promise.all(
          streamIds.map((id) => getStreamById(workerAddress, id)),
        );

        const workerStreams: WorkerStream[] = await Promise.all(
          streamIds
            .map((id: bigint, i: number) => ({
              id,
              stream: streamResults[i],
            }))
            .filter(
              (x: {
                id: bigint;
                stream: ContractStream | null;
              }): x is { id: bigint; stream: ContractStream } =>
                x.stream !== null,
            )
            .map(
              async ({
                id,
                stream: s,
              }: {
                id: bigint;
                stream: ContractStream;
              }) => {
                const streamId = id.toString();
                const tokenSymbol = await getTokenSymbol(
                  workerAddress,
                  s.token,
                );
                const isCompleted = s.status === 3;
                const proof = isCompleted ? await fetchProof(streamId) : null;
                const employerName = await resolveEmployerName(s.employer);
                return {
                  id: streamId,
                  employerName,
                  employerAddress: s.employer,
                  flowRate: Number(s.rate ?? s.ratePerSecond) / USDC_UNIT,
                  tokenSymbol,
                  startTime: Number(s.start_ts ?? s.startTs),
                  endTime: Number(s.end_ts ?? s.endTs),
                  cliffTime: Number(s.cliff_ts ?? s.cliffTs),
                  totalAmount:
                    Number(s.total_amount ?? s.totalAmount) / USDC_UNIT,
                  claimedAmount:
                    Number(s.withdrawn_amount ?? s.withdrawnAmount) / USDC_UNIT,
                  status: s.status,
                  proofCid: proof?.cid,
                  proofGatewayUrl: proof?.gatewayUrl,
                };
              },
            ),
        );

        setStreams(workerStreams);

        const events = await getWorkerWithdrawalEvents(workerAddress);

        const history: WithdrawalRecord[] = await Promise.all(
          events.map(async (ev) => {
            const tokenSymbol = await getTokenSymbol(workerAddress, ev.token);
            return {
              id: ev.txHash,
              streamId: ev.streamId.toString(),
              amount: (Number(ev.amount) / USDC_UNIT).toFixed(7),
              tokenSymbol,
              date: new Date(ev.ledgerClosedAt).toLocaleString(),
              txHash: ev.txHash,
            };
          }),
        );

        setWithdrawalHistory(history);
        void setCache(`worker-streams-${workerAddress}`, workerStreams);
        void setCache(`withdrawal-history-${workerAddress}`, history);
      } catch (err) {
        const cachedStreams = await getCache(`worker-streams-${workerAddress}`);
        const cachedHistory = await getCache(
          `withdrawal-history-${workerAddress}`,
        );

        if (cachedStreams || cachedHistory) {
          setStreams(cachedStreams || []);
          setWithdrawalHistory(cachedHistory || []);
          setError(null);
        } else {
          const message =
            err instanceof Error ? err.message : "Failed to load stream data";
          setError(message);
          setStreams([]);
          setWithdrawalHistory([]);
        }
      } finally {
        setIsLoading(false);
      }
    };

    void fetchData();
  }, [workerAddress, fetchTick]);

  return {
    streams,
    withdrawalHistory,
    isLoading,
    error,
    refetch,
  };
};
