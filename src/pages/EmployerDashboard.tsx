import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { createPublicClient, http } from "viem";
import { SeoHelmet } from "../components/seo/SeoHelmet";
import EmptyState from "../components/EmptyState";
import { useWallet } from "../hooks/useWallet";
import { usePayroll } from "../hooks/usePayroll";
import { arcTestnet, ARC_USDC_ADDRESS, formatUsdc } from "../contracts/util";
import { StatTileSkeleton, SkeletonRow } from "../components/Loading";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── USDC balance via viem ────────────────────────────────────────────────────

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
] as const;

async function fetchUsdcBalance(address: string): Promise<bigint> {
  try {
    const client = createPublicClient({ chain: arcTestnet, transport: http() });
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

// ─── Stat card ────────────────────────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: boolean;
  action?: { label: string; onClick: () => void };
}> = ({ label, value, sub, accent, action }) => (
  <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5 flex flex-col gap-3">
    <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-neutral-500">
      {label}
    </p>
    <p
      className="font-mono text-[28px] font-bold leading-none tabular-nums text-white"
      style={accent ? { color: "#facc15" } : {}}
    >
      {value}
    </p>
    {sub && <p className="text-[14px] text-neutral-500">{sub}</p>}
    {action && (
      <button
        onClick={action.onClick}
        className="mt-auto inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/[0.08] w-fit"
      >
        {action.label}
      </button>
    )}
  </div>
);

// ─── Stream row ───────────────────────────────────────────────────────────────

function StreamRow({
  stream,
  onClick,
}: {
  stream: {
    id: string;
    employeeName: string;
    employeeAddress: string;
    flowRate: string;
    tokenSymbol: string;
    totalAmount: string;
    totalStreamed: string;
    status: string;
  };
  onClick: () => void;
}) {
  const pct =
    parseFloat(stream.totalAmount) > 0
      ? Math.min(
          100,
          (parseFloat(stream.totalStreamed) / parseFloat(stream.totalAmount)) *
            100,
        )
      : 0;
  const statusCls =
    stream.status === "active"
      ? "bg-green-500/10 text-green-400"
      : stream.status === "paused"
        ? "bg-yellow-400/10 text-yellow-400"
        : "bg-white/[0.06] text-neutral-500";
  const statusLabel =
    stream.status === "active"
      ? "Streaming"
      : stream.status === "paused"
        ? "Paused"
        : stream.status === "completed"
          ? "Completed"
          : "Cancelled";

  return (
    <div
      onClick={onClick}
      className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0a0a0a] px-5 py-4 transition-colors hover:border-yellow-400/20 hover:bg-[#0e0e0e]"
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black text-black"
        style={{ backgroundColor: "#facc15" }}
      >
        {stream.employeeName.slice(0, 2).toUpperCase()}
      </div>

      <div className="min-w-0 flex-1">
        <p className="font-mono text-[13px] font-semibold text-white truncate">
          {stream.employeeAddress}
        </p>
        <p className="text-[11px] text-neutral-600 mt-0.5">
          {stream.totalStreamed} / {stream.totalAmount} {stream.tokenSymbol}
        </p>
      </div>

      <div className="hidden sm:flex items-center gap-3 shrink-0">
        <div className="w-20">
          <div className="h-[3px] w-full rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${pct}%`, backgroundColor: "#facc15" }}
            />
          </div>
          <p className="mt-0.5 text-[10px] text-right text-neutral-700">
            {pct.toFixed(0)}%
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusCls}`}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

// ─── Workforce panel ──────────────────────────────────────────────────────────

interface EmployeeRow {
  worker_address: string;
  full_name: string;
  job_title: string;
  department: string | null;
  registered_at: string;
}

function WorkforcePanel({
  employerAddress,
}: {
  employerAddress: string | undefined;
}) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employerAddress) return;
    const run = async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API_BASE}/api/employers/employees`, {
          headers: { "x-user-id": employerAddress, "x-user-role": "user" },
        });
        const j = (await r.json()) as { employees?: EmployeeRow[] };
        setEmployees(j.employees ?? []);
      } catch {
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [employerAddress]);

  if (loading) {
    return (
      <div className="mb-8 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
        <div className="h-4 w-40 animate-pulse rounded-xl bg-white/[0.06] mb-4" />
        <div className="space-y-2">
          <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="h-14 animate-pulse rounded-xl bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (employees.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-white">Workforce</h2>
          <p className="text-[11px] text-neutral-600 mt-0.5">
            {employees.length} {employees.length === 1 ? "person" : "people"}{" "}
            registered via invite link
          </p>
        </div>
        <button
          onClick={() => void navigate("/employer/workforce")}
          className="text-[12px] font-semibold transition-colors hover:text-white"
          style={{ color: "#facc15" }}
        >
          Manage all →
        </button>
      </div>
      <div className="flex flex-col gap-2">
        {employees.slice(0, 5).map((emp) => {
          const initials = emp.full_name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .slice(0, 2)
            .toUpperCase();
          const shortAddr = `${emp.worker_address.slice(0, 6)}…${emp.worker_address.slice(-4)}`;

          return (
            <div
              key={emp.worker_address}
              className="flex items-center gap-4 rounded-2xl border border-white/[0.06] bg-[#0a0a0a] px-5 py-4"
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[11px] font-black text-black"
                style={{ backgroundColor: "#facc15" }}
              >
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-white leading-none">
                  {emp.full_name}
                </p>
                <p className="text-[12px] text-neutral-500 mt-0.5">
                  {emp.job_title}
                </p>
                <p className="font-mono text-[11px] text-neutral-700 mt-0.5">
                  {shortAddr}
                </p>
              </div>
              <button
                onClick={() =>
                  void navigate(`/create-stream?worker=${emp.worker_address}`)
                }
                className="shrink-0 rounded-xl px-4 py-2 text-[13px] font-bold text-black transition-colors hover:opacity-90"
                style={{ backgroundColor: "#facc15" }}
              >
                Stream
              </button>
            </div>
          );
        })}
        {employees.length > 5 && (
          <button
            onClick={() => void navigate("/employer/workforce")}
            className="rounded-2xl border border-dashed border-white/[0.07] py-3 text-[13px] font-semibold text-neutral-600 transition-colors hover:text-white"
          >
            +{employees.length - 5} more in workforce →
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const EmployerDashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { address } = useWallet();

  const {
    activeStreamsCount,
    activeStreams,
    streams,
    isLoading,
    payrollSummaryError,
    refreshData,
  } = usePayroll(address);

  // Wallet USDC balance
  const [walletUsdc, setWalletUsdc] = useState<bigint>(0n);
  useEffect(() => {
    if (!address) return;
    const run = async () => {
      setWalletUsdc(await fetchUsdcBalance(address));
    };
    void run();
  }, [address]);

  const seoDescription = isLoading
    ? t("dashboard.loading_description")
    : t("dashboard.seo_description", {
        activeStreamsCount,
        totalLiabilities: "0",
      });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <SeoHelmet
          title={t("dashboard.title")}
          description={seoDescription}
          path="/employer/dashboard"
          robots="noindex,nofollow"
        />
        <div className="px-6 py-8 sm:px-8 sm:py-10">
          <div className="mb-8">
            <div className="h-7 w-40 animate-pulse rounded-xl bg-white/[0.06]" />
            <div className="mt-1 h-4 w-56 animate-pulse rounded-xl bg-white/[0.04]" />
          </div>
          <div
            className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3"
            aria-busy="true"
          >
            <StatTileSkeleton />
            <StatTileSkeleton />
            <StatTileSkeleton />
          </div>
          <div className="space-y-3">
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </>
    );
  }

  // ── Main ─────────────────────────────────────────────────────────────────
  return (
    <>
      <SeoHelmet
        title={t("dashboard.title")}
        description={seoDescription}
        path="/employer/dashboard"
        robots="noindex,nofollow"
      />

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">
              {t("dashboard.title")}
            </h1>
            <p className="mt-1 text-[15px] text-neutral-500">
              Payroll overview · Arc Testnet
            </p>
          </div>
          <button
            onClick={() => void navigate("/employer/create-stream")}
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13px] font-bold text-black transition-colors hover:opacity-90 shrink-0"
            style={{ backgroundColor: "#facc15" }}
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <path d="M12 5v14M5 12h14" strokeLinecap="round" />
            </svg>
            {t("dashboard.create_new_stream")}
          </button>
        </div>

        {/* Error */}
        {payrollSummaryError && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-400">
            {payrollSummaryError}{" "}
            <button
              onClick={() => void refreshData()}
              className="underline hover:text-red-300"
            >
              Retry
            </button>
          </div>
        )}

        {/* KPI cards */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label={t("dashboard.treasury_balance")}
            value={`${formatUsdc(walletUsdc, 2)} USDC`}
            sub="Wallet balance on Arc"
            accent
            action={{
              label: t("dashboard.manage_treasury"),
              onClick: () => void navigate("/employer/treasury"),
            }}
          />
          <StatCard
            label={t("dashboard.active_streams")}
            value={activeStreamsCount ?? 0}
            sub={`${activeStreamsCount ?? 0} streaming right now`}
            action={{
              label: "View payroll →",
              onClick: () => void navigate("/employer/payroll"),
            }}
          />
          <StatCard
            label="Total Streams"
            value={streams.length}
            sub="All time"
            action={{
              label: "New stream →",
              onClick: () => void navigate("/employer/create-stream"),
            }}
          />
        </div>

        {/* Workforce panel */}
        <WorkforcePanel employerAddress={address} />

        {/* Active streams */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[20px] font-bold text-white">
                {t("dashboard.active_streams")}
              </h2>
              <p className="text-[11px] text-neutral-600 mt-0.5">
                {activeStreamsCount} active payroll streams
              </p>
            </div>
          </div>

          {activeStreams.length === 0 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-[#0a0a0a] p-10">
              <EmptyState
                title={t("dashboard.no_streams_title")}
                description={t("dashboard.no_streams_description")}
                variant="streams"
                actionLabel={t("dashboard.create_new_stream")}
                onAction={() => void navigate("/employer/create-stream")}
              />
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {activeStreams.map((stream) => (
                <StreamRow
                  key={stream.id}
                  stream={stream}
                  onClick={() => void navigate(`/stream/${stream.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default EmployerDashboard;
