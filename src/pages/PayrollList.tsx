/**
 * PayrollList page
 * ─────────────────
 * Lists all payroll groups for the current organization.
 * Shows status, total amount, stream count, and actions.
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { useOrg } from "../context/OrgContext";
import { usePayrolls, type PayrollRecord } from "../hooks/usePayrolls";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: "bg-green-500/10 text-green-400 border-green-500/20",
    completed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    processing: "bg-yellow-400/10 text-yellow-400 border-yellow-400/20",
    draft: "bg-white/[0.06] text-neutral-400 border-white/[0.08]",
    failed: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
        styles[status] ?? styles.draft
      }`}
    >
      {status}
    </span>
  );
}

function PayrollCard({ payroll }: { payroll: PayrollRecord }) {
  const navigate = useNavigate();

  const totalUsdc = Number(BigInt(payroll.total_amount)) / 1e6;

  return (
    <div
      onClick={() => navigate(`/employer/payrolls/${payroll.id}`)}
      className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5 cursor-pointer transition-colors hover:border-white/[0.12]"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[15px] font-semibold text-white">{payroll.name}</p>
          <p className="text-[11px] text-neutral-600 mt-0.5">
            {new Date(payroll.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
        <StatusBadge status={payroll.status} />
      </div>

      <div className="flex items-end justify-between">
        <div>
          <p className="text-[22px] font-bold text-white leading-none">
            {totalUsdc.toLocaleString()}{" "}
            <span className="text-[14px] text-neutral-400 font-normal">
              USDC
            </span>
          </p>
          <p className="text-[12px] text-neutral-600 mt-1">
            {payroll.stream_count} stream
            {payroll.stream_count !== 1 ? "s" : ""}
          </p>
        </div>
        <svg
          className="h-4 w-4 text-neutral-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </div>
    </div>
  );
}

const PayrollList: React.FC = () => {
  const navigate = useNavigate();
  const { activeOrg } = useOrg();
  const { payrolls, isLoading, error } = usePayrolls(activeOrg?.orgId);

  if (!activeOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="text-[14px] text-neutral-500">
          No organization selected.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] font-bold text-white tracking-tight">
            Payrolls
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Manage grouped stream payments for your team.
          </p>
        </div>
        <button
          onClick={() => void navigate("/employer/payrolls/new")}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90"
          style={{ backgroundColor: "#facc15" }}
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Payroll
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[12px] text-red-400">
          {error}
        </p>
      )}

      {/* Payroll list */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-white/[0.06] bg-[#0a0a0a]"
            />
          ))}
        </div>
      ) : payrolls.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04]">
            <svg
              className="h-7 w-7 text-neutral-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <p className="mb-1 text-[16px] font-bold text-white">
            No payrolls yet
          </p>
          <p className="mx-auto mb-5 max-w-sm text-[13px] text-neutral-600">
            Create a payroll to send payments to multiple workers at once.
          </p>
          <button
            onClick={() => void navigate("/employer/payrolls/new")}
            className="rounded-xl px-5 py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90"
            style={{ backgroundColor: "#facc15" }}
          >
            Create your first payroll
          </button>
        </div>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-neutral-700">
            {payrolls.length} payroll{payrolls.length !== 1 ? "s" : ""}
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {payrolls.map((payroll) => (
              <PayrollCard key={payroll.id} payroll={payroll} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default PayrollList;
