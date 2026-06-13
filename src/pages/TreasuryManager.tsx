import React, { useState, useEffect } from "react";
import { createPublicClient, http } from "viem";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import {
  getStreamsByEmployer,
  type ContractStream,
} from "../contracts/payroll_stream";
import {
  arcTestnet,
  ARC_USDC_ADDRESS,
  formatUsdc,
  network,
} from "../contracts/util";
import { PAYROLL_STREAM_ADDRESS } from "../contracts/payroll_stream";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

function getClient() {
  return createPublicClient({ chain: arcTestnet, transport: http() });
}

async function fetchUsdcBalance(address: string): Promise<bigint> {
  try {
    const client = getClient();
    const result = await client.readContract({
      address: ARC_USDC_ADDRESS,
      abi: ERC20_BALANCE_ABI,
      functionName: "balanceOf",
      args: [address as `0x${string}`],
    });
    return result;
  } catch {
    return 0n;
  }
}

function isActive(s: ContractStream) {
  return s.status === 0 || s.status === 4; // Active=0, Paused=4
}

function fmtUsdc(raw: bigint) {
  return formatUsdc(raw, 2);
}

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// ─── Stream row ───────────────────────────────────────────────────────────────

function StreamRow({ s, id }: { s: ContractStream; id: number }) {
  const navigate = useNavigate();
  const locked = s.totalAmount - s.withdrawnAmount;
  const pct =
    s.totalAmount > 0n ? Number((s.withdrawnAmount * 100n) / s.totalAmount) : 0;

  const statusLabel =
    s.status === 0
      ? "Streaming"
      : s.status === 4
        ? "Paused"
        : s.status === 3
          ? "Completed"
          : s.status === 2
            ? "Cancelled"
            : "Other";

  const statusCls =
    s.status === 0
      ? "bg-green-500/10 text-green-400"
      : s.status === 4
        ? "bg-yellow-400/10 text-yellow-400"
        : "bg-white/[0.06] text-neutral-500";

  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0a0a0a] px-4 py-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono text-[11px] text-neutral-600">#{id}</span>
          <span className="font-mono text-[12px] text-neutral-400 truncate">
            → {shortAddr(s.worker)}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${statusCls}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="flex items-center justify-between text-[12px] mb-2">
        <span className="text-neutral-500">Total</span>
        <span className="font-bold text-white">
          {fmtUsdc(s.totalAmount)} USDC
        </span>
      </div>
      <div className="flex items-center justify-between text-[12px] mb-2">
        <span className="text-neutral-500">Paid to worker</span>
        <span className="text-green-400">
          {fmtUsdc(s.withdrawnAmount)} USDC
        </span>
      </div>
      <div className="flex items-center justify-between text-[12px] mb-3">
        <span className="text-neutral-500">Still locked</span>
        <span className="font-bold" style={{ color: "#facc15" }}>
          {fmtUsdc(locked)} USDC
        </span>
      </div>

      <div className="h-[3px] w-full rounded-full bg-white/[0.06] overflow-hidden mb-2">
        <div
          className="h-full rounded-full bg-green-500 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-neutral-700">
        <span>{pct}% paid out</span>
        <button
          onClick={() => void navigate(`/stream/${id}`)}
          className="text-yellow-400 hover:underline"
        >
          View stream ↗
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TreasuryManager: React.FC = () => {
  const { address } = useWallet();
  const navigate = useNavigate();

  const [walletUsdc, setWalletUsdc] = useState<bigint>(0n);
  const [streams, setStreams] = useState<
    Array<{ id: number; stream: ContractStream }>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address) return;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [bal, { streams: raw }] = await Promise.all([
          fetchUsdcBalance(address),
          getStreamsByEmployer(address).catch(() => ({
            streams: [] as ContractStream[],
          })),
        ]);
        setWalletUsdc(bal);
        const paired = raw.map((s, i) => ({ id: i + 1, stream: s }));
        setStreams(paired);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [address, tick]);

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10">
          <svg
            className="h-8 w-8 text-yellow-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
        <h2 className="text-[20px] font-bold text-white mb-2">
          Connect your wallet
        </h2>
        <p className="text-[14px] text-neutral-500">
          Connect to view your treasury.
        </p>
      </div>
    );
  }

  // Compute totals
  const activeStreams = streams.filter((r) => isActive(r.stream));
  const totalLocked = activeStreams.reduce(
    (s, r) => s + r.stream.totalAmount - r.stream.withdrawnAmount,
    0n,
  );
  const totalCommitted = streams.reduce((s, r) => s + r.stream.totalAmount, 0n);
  const totalPaid = streams.reduce((s, r) => s + r.stream.withdrawnAmount, 0n);

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Treasury
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Your USDC wallet balance and funds committed to active streams on
            Arc Testnet.
          </p>
        </div>
        <button
          onClick={() => void navigate("/employer/create-stream")}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-black hover:opacity-90 transition-all"
          style={{ backgroundColor: "#facc15" }}
        >
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New stream
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-white/[0.04]"
            />
          ))}
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              {
                label: "Wallet balance",
                value: `${fmtUsdc(walletUsdc)} USDC`,
                accent: true,
                sub: "Available to create streams",
              },
              {
                label: "Locked in streams",
                value: `${fmtUsdc(totalLocked)} USDC`,
                sub: `${activeStreams.length} active stream${activeStreams.length !== 1 ? "s" : ""}`,
              },
              {
                label: "Total committed",
                value: `${fmtUsdc(totalCommitted)} USDC`,
                sub: "Across all streams ever",
              },
              {
                label: "Paid to workers",
                value: `${fmtUsdc(totalPaid)} USDC`,
                sub: "Withdrawn by workers",
              },
            ].map(({ label, value, accent, sub }) => (
              <div
                key={label}
                className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5"
              >
                <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
                  {label}
                </p>
                <p
                  className="font-mono text-[20px] font-bold leading-none"
                  style={accent ? { color: "#facc15" } : { color: "#fff" }}
                >
                  {value}
                </p>
                {sub && (
                  <p className="text-[11px] text-neutral-700 mt-1.5">{sub}</p>
                )}
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="mb-8 rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-5">
            <p className="mb-3 text-[13px] font-bold text-white">
              How Arc treasury works
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-[12px]">
              {[
                {
                  n: "1",
                  title: "Approve & create",
                  desc: "When you create a stream, you approve the USDC amount and it transfers directly from your wallet into the contract.",
                },
                {
                  n: "2",
                  title: "Locks per stream",
                  desc: "Funds are locked in the PayrollStream contract per stream. Workers earn from it continuously at the rate you set.",
                },
                {
                  n: "3",
                  title: "Released on completion",
                  desc: "When a stream completes or is cancelled, any unearned USDC is returned to your wallet automatically.",
                },
              ].map(({ n, title, desc }) => (
                <div key={n} className="flex gap-3">
                  <div
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-black"
                    style={{ backgroundColor: "#facc15" }}
                  >
                    {n}
                  </div>
                  <div>
                    <p className="font-bold text-white mb-0.5">{title}</p>
                    <p className="text-neutral-600 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-400">
              {error}{" "}
              <button
                onClick={() => setTick((t) => t + 1)}
                className="underline hover:text-red-300"
              >
                Retry
              </button>
            </div>
          )}

          {/* Stream breakdown */}
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-white">
                Stream breakdown
              </h2>
              <span className="text-[12px] text-neutral-600">
                {streams.length} total
              </span>
            </div>

            {streams.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-12 text-center">
                <p className="text-[15px] font-bold text-white mb-1">
                  No streams yet
                </p>
                <p className="text-[13px] text-neutral-600 mb-5">
                  Create your first payroll stream to start funding workers.
                </p>
                <button
                  onClick={() => void navigate("/employer/create-stream")}
                  className="rounded-xl px-5 py-2.5 text-[14px] font-bold text-black hover:opacity-90 transition-all"
                  style={{ backgroundColor: "#facc15" }}
                >
                  Create first stream
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {streams.map((r) => (
                  <StreamRow key={r.id} s={r.stream} id={r.id} />
                ))}
              </div>
            )}
          </div>

          {/* Contract info footer */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.05] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <span className="font-mono text-[11px] text-neutral-600">
                PayrollStream · {PAYROLL_STREAM_ADDRESS.slice(0, 10)}…
                {PAYROLL_STREAM_ADDRESS.slice(-6)}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href={`${network.explorerUrl}/address/${ARC_USDC_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] text-neutral-600 hover:text-yellow-400 transition-colors"
              >
                USDC token ↗
              </a>
              <a
                href={`${network.explorerUrl}/address/${PAYROLL_STREAM_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] transition-colors hover:underline"
                style={{ color: "#facc15" }}
              >
                View contract ↗
              </a>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default TreasuryManager;
