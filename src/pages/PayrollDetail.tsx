/**
 * PayrollDetail page
 * ───────────────────
 * Shows a single payroll with its entries and their status.
 */

import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import {
  getPayrollDetail,
  type PayrollRecord,
  type PayrollEntryRecord,
} from "../hooks/usePayrolls";

function shortAddr(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function EntryStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    pending: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase border ${
        styles[status] ?? styles.pending
      }`}
    >
      {status}
    </span>
  );
}

const PayrollDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { address } = useWallet();

  const [payroll, setPayroll] = useState<PayrollRecord | null>(null);
  const [entries, setEntries] = useState<PayrollEntryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!address || !id) return;

    let cancelled = false;
    const fetchDetail = async () => {
      setIsLoading(true);
      setError(null);

      const data = await getPayrollDetail(Number(id), address);
      if (cancelled) return;

      if (data) {
        setPayroll(data.payroll);
        setEntries(data.entries);
      } else {
        setError("Payroll not found");
      }

      setIsLoading(false);
    };

    void fetchDetail();
    return () => {
      cancelled = true;
    };
  }, [address, id]);

  if (isLoading) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10 max-w-3xl mx-auto">
        <div className="space-y-4">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-white/[0.04]" />
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />
          <div className="h-48 animate-pulse rounded-2xl bg-white/[0.04]" />
        </div>
      </div>
    );
  }

  if (error || !payroll) {
    return (
      <div className="px-6 py-8 sm:px-8 sm:py-10 max-w-3xl mx-auto text-center">
        <p className="text-[14px] text-red-400 mb-4">
          {error ?? "Payroll not found"}
        </p>
        <button
          onClick={() => void navigate("/employer/payrolls")}
          className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90"
          style={{ backgroundColor: "#facc15" }}
        >
          Back to payrolls
        </button>
      </div>
    );
  }

  const totalUsdc = Number(BigInt(payroll.total_amount)) / 1e6;
  const activeCount = entries.filter((e) => e.status === "active").length;
  const failedCount = entries.filter((e) => e.status === "failed").length;
  const pendingCount = entries.filter((e) => e.status === "pending").length;

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <button
          onClick={() => void navigate("/employer/payrolls")}
          className="text-[12px] text-neutral-500 hover:text-white transition-colors mb-3"
        >
          ← Back to payrolls
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[24px] font-bold text-white tracking-tight">
              {payroll.name}
            </h1>
            <p className="mt-1 text-[13px] text-neutral-500">
              Created{" "}
              {new Date(payroll.created_at).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase border ${
              payroll.status === "active"
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : payroll.status === "completed"
                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  : "bg-white/[0.06] text-neutral-400 border-white/[0.08]"
            }`}
          >
            {payroll.status}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total", value: `${totalUsdc.toLocaleString()} USDC` },
          { label: "Streams", value: payroll.stream_count },
          { label: "Active", value: activeCount, accent: true },
          { label: "Failed", value: failedCount, error: failedCount > 0 },
        ].map(({ label, value, accent, error: isError }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
              {label}
            </p>
            <p
              className="text-[22px] font-black"
              style={{
                color: isError
                  ? "#f87171"
                  : accent
                    ? "#facc15"
                    : "#fff",
              }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Entries table */}
      <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h2 className="text-[15px] font-bold text-white">Streams</h2>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {entries.map((entry) => {
            const amountUsdc = Number(BigInt(entry.amount)) / 1e6;

            return (
              <div
                key={entry.id}
                className="flex items-center justify-between px-5 py-4"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-9 w-9 rounded-xl bg-yellow-400/10 flex items-center justify-center text-[11px] font-black text-yellow-400 shrink-0">
                    {entry.worker_address.slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-white font-mono truncate">
                      {shortAddr(entry.worker_address)}
                    </p>
                    {entry.stream_id && (
                      <Link
                        to="/employer/payroll"
                        className="text-[11px] text-yellow-400 hover:underline"
                      >
                        Stream #{entry.stream_id}
                      </Link>
                    )}
                    {entry.error_message && (
                      <p className="text-[11px] text-red-400 truncate">
                        {entry.error_message}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <EntryStatusBadge status={entry.status} />
                  <p className="text-[14px] font-semibold text-white text-right w-24">
                    {amountUsdc.toLocaleString()} USDC
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PayrollDetail;
