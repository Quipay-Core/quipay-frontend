import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import InviteLink from "../components/InviteLink";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

/* ── Types ──────────────────────────────────────────────────────────── */

interface EmployeeRow {
  worker_address: string;
  full_name: string;
  job_title: string;
  department: string | null;
  work_email: string | null;
  start_date: string | null;
  employee_ref: string | null;
  registered_at: string;
}

/* ── Utilities ──────────────────────────────────────────────────────── */

function shortAddr(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

/* ── Worker card ────────────────────────────────────────────────────── */

function WorkerCard({ worker }: { worker: EmployeeRow }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyAddress = useCallback(async () => {
    await navigator.clipboard.writeText(worker.worker_address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [worker.worker_address]);

  const initials = worker.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden transition-colors hover:border-white/[0.12]">
      {/* Header */}
      <div className="flex items-start gap-4 p-5">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[13px] font-black text-black"
          style={{ backgroundColor: "#facc15" }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-white leading-none mb-0.5">
            {worker.full_name}
          </p>
          <p className="text-[12px] text-neutral-500">{worker.job_title}</p>
          {worker.department && (
            <p className="text-[11px] text-neutral-700 mt-0.5">
              {worker.department}
            </p>
          )}
          <button
            onClick={() => void copyAddress()}
            className="mt-1.5 flex items-center gap-1.5 font-mono text-[11px] text-neutral-600 transition-colors hover:text-yellow-400"
          >
            {shortAddr(worker.worker_address)}
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <rect
                x="9"
                y="9"
                width="13"
                height="13"
                rx="2"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
              />
            </svg>
            {copied && <span className="text-green-400">Copied!</span>}
          </button>
        </div>
      </div>

      {/* Meta */}
      <div className="border-t border-white/[0.05] px-5 py-3">
        <p className="text-[11px] text-neutral-700">
          Registered{" "}
          {new Date(worker.registered_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
        {worker.work_email && (
          <p className="text-[11px] text-neutral-600 mt-0.5">
            {worker.work_email}
          </p>
        )}
      </div>

      {/* Action */}
      <div className="border-t border-white/[0.05] p-4">
        <button
          onClick={() =>
            void navigate(`/create-stream?worker=${worker.worker_address}`)
          }
          className="w-full rounded-xl py-2.5 text-[13px] font-bold text-black transition-all hover:opacity-90"
          style={{ backgroundColor: "#facc15" }}
        >
          Create payroll stream
        </button>
      </div>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────────────────────── */

const WorkforceRegistry: React.FC = () => {
  const { t } = useTranslation();
  const { address } = useWallet();
  const navigate = useNavigate();

  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!address) return;
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const r = await fetch(`${API_BASE}/api/employers/employees`, {
          headers: { "x-user-id": address, "x-user-role": "user" },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as { employees?: EmployeeRow[] };
        setEmployees(j.employees ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, [address, tick]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return employees.filter(
      (e) =>
        e.worker_address.toLowerCase().includes(q) ||
        e.full_name.toLowerCase().includes(q) ||
        e.job_title.toLowerCase().includes(q),
    );
  }, [employees, searchQuery]);

  if (!address) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-yellow-400/20 bg-yellow-400/10">
          <svg
            className="h-8 w-8 text-yellow-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </div>
        <h2 className="text-[20px] font-bold text-white mb-2">
          {t("workforce.title")}
        </h2>
        <p className="text-[14px] text-neutral-500">
          {t("workforce.wallet_required")}
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
            {t("workforce.title")}
          </h1>
          <p className="mt-1 text-[14px] text-neutral-500">
            Workers who joined via your invite link
          </p>
        </div>
        <button
          onClick={() => void navigate("/employer/create-stream")}
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
          New Stream
        </button>
      </div>

      {/* Invite link */}
      <div className="mb-6">
        <InviteLink />
      </div>

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "Total registered", value: employees.length },
          {
            label: "With job title",
            value: employees.filter((e) => !!e.job_title).length,
            accent: true,
          },
          {
            label: "With email",
            value: employees.filter((e) => !!e.work_email).length,
          },
        ].map(({ label, value, accent }) => (
          <div
            key={label}
            className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-4"
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
              {label}
            </p>
            <p
              className="text-[26px] font-black"
              style={accent ? { color: "#facc15" } : { color: "#fff" }}
            >
              {value}
            </p>
          </div>
        ))}
      </div>

      {/* Search + error */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <svg
            className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-700"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className="w-full rounded-xl border border-white/[0.1] bg-black py-2.5 pl-10 pr-4 text-[14px] text-white placeholder:text-neutral-700 focus:border-yellow-400/40 focus:outline-none focus:ring-1 focus:ring-yellow-400/20"
            placeholder="Search by name, wallet, or job title…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-[13px] text-red-400">
            {error}{" "}
            <button
              className="underline hover:text-red-300"
              onClick={() => setTick((t) => t + 1)}
            >
              Retry
            </button>
          </p>
        )}
      </div>

      {/* Workers grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-2xl border border-white/[0.06] bg-[#0a0a0a]"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
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
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          {searchQuery ? (
            <>
              <p className="text-[16px] font-bold text-white mb-1">
                No workers match your search
              </p>
              <p className="text-[13px] text-neutral-600">
                Try a different name, address, or job title.
              </p>
              <button
                onClick={() => setSearchQuery("")}
                className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
              >
                Clear search
              </button>
            </>
          ) : (
            <>
              <p className="mb-1 text-[16px] font-bold text-white">
                No workers yet
              </p>
              <p className="mx-auto mb-5 max-w-sm text-[13px] text-neutral-600">
                Share your invite link so workers can register their wallet and
                details.
              </p>
            </>
          )}
        </div>
      ) : (
        <>
          <p className="mb-4 text-[13px] text-neutral-700">
            {filtered.length} {filtered.length === 1 ? "worker" : "workers"}
            {searchQuery ? " matched" : " registered"}
          </p>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((worker) => (
              <WorkerCard key={worker.worker_address} worker={worker} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default WorkforceRegistry;
