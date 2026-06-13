import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWriteContract } from "wagmi";
import { createPublicClient, http } from "viem";
import { useNotification } from "../hooks/useNotification";
import { useWallet } from "../hooks/useWallet";
import { PAYROLL_STREAM_ADDRESS } from "../contracts/payroll_stream";
import { PAYROLL_STREAM_ABI } from "../contracts/abi/PayrollStream.abi";
import { ARC_USDC_ADDRESS, arcTestnet, parseUsdc } from "../contracts/util";
import { SeoHelmet } from "../components/seo/SeoHelmet";

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

// ─── Types ────────────────────────────────────────────────────────────────────

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

type TxStep =
  | "idle"
  | "approving"
  | "approve-wait"
  | "creating"
  | "create-wait"
  | "done";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUnixSec(d: string): number {
  return Math.floor(new Date(d).getTime() / 1000);
}

function shortAddr(a: string): string {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function getInitials(name: string, wallet: string): string {
  if (!name) return wallet.slice(1, 3).toUpperCase();
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const CreateStream: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedWorker = searchParams.get("worker")?.toLowerCase() ?? null;

  const { address } = useWallet();
  const { addNotification } = useNotification();
  const { writeContractAsync } = useWriteContract();

  // ── Workers ──────────────────────────────────────────────────────────────

  const [workers, setWorkers] = useState<EmployeeRow[]>([]);
  const [isLoadingWorkers, setIsLoadingWorkers] = useState(false);
  const [workerError, setWorkerError] = useState<string | null>(null);
  const [workerTick, setWorkerTick] = useState(0);

  useEffect(() => {
    if (!address) return;
    const run = async () => {
      setIsLoadingWorkers(true);
      setWorkerError(null);
      try {
        const r = await fetch(`${API_BASE}/api/employers/employees`, {
          headers: { "x-user-id": address, "x-user-role": "user" },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const j = (await r.json()) as { employees?: EmployeeRow[] };
        setWorkers(j.employees ?? []);
      } catch (e: unknown) {
        setWorkerError(
          e instanceof Error ? e.message : "Failed to load workers",
        );
      } finally {
        setIsLoadingWorkers(false);
      }
    };
    void run();
  }, [address, workerTick]);

  // ── Selection + amounts ───────────────────────────────────────────────────

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [bulkAmount, setBulkAmount] = useState("");

  // Once workers load, set initial selection.
  // If ?worker= is present, select only that worker; otherwise select all.
  useEffect(() => {
    if (workers.length === 0) return;
    const update = () => {
      setSelected((prev) => {
        const next = { ...prev };
        workers.forEach((w) => {
          if (next[w.worker_address] === undefined) {
            next[w.worker_address] = preselectedWorker
              ? w.worker_address.toLowerCase() === preselectedWorker
              : true;
          }
        });
        return next;
      });
    };
    update();
  }, [workers, preselectedWorker]);

  const toggleWorker = (addr: string) =>
    setSelected((s) => ({ ...s, [addr]: !s[addr] }));

  const setAmount = (addr: string, val: string) =>
    setAmounts((a) => ({ ...a, [addr]: val }));

  const applyBulkAmount = () => {
    if (!bulkAmount) return;
    const next: Record<string, string> = { ...amounts };
    workers
      .filter((w) => selected[w.worker_address])
      .forEach((w) => {
        next[w.worker_address] = bulkAmount;
      });
    setAmounts(next);
  };

  const selectedWorkers = workers.filter((w) => selected[w.worker_address]);

  const totalUsdcFloat = selectedWorkers.reduce(
    (s, w) => s + (parseFloat(amounts[w.worker_address] ?? "") || 0),
    0,
  );

  // ── Stream config ─────────────────────────────────────────────────────────

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [cliffDate, setCliffDate] = useState("");

  const startTs = startDate ? toUnixSec(startDate) : 0;
  const endTs = endDate ? toUnixSec(endDate) : 0;
  const cliffTs = cliffDate ? toUnixSec(cliffDate) : startTs;
  const durDays = startTs && endTs ? Math.round((endTs - startTs) / 86400) : 0;

  // ── Validation ────────────────────────────────────────────────────────────

  const missingAmounts = selectedWorkers.filter(
    (w) => !(parseFloat(amounts[w.worker_address] ?? "") > 0),
  );

  const canSubmit =
    !!address &&
    selectedWorkers.length > 0 &&
    missingAmounts.length === 0 &&
    startDate.length > 0 &&
    endDate.length > 0 &&
    endTs > startTs &&
    (!cliffDate || (cliffTs >= startTs && cliffTs <= endTs));

  // ── Transaction ───────────────────────────────────────────────────────────

  const [txStep, setTxStep] = useState<TxStep>("idle");
  const [txError, setTxError] = useState<string | null>(null);

  const isSubmitting = txStep !== "idle" && txStep !== "done";

  const handleSubmit = async () => {
    if (!address || !canSubmit) return;
    setTxError(null);

    const totalUsdc = selectedWorkers.reduce(
      (sum, w) => sum + parseUsdc(amounts[w.worker_address] ?? "0"),
      0n,
    );

    const params = selectedWorkers.map((w) => ({
      worker: w.worker_address,
      token: ARC_USDC_ADDRESS,
      totalAmount: parseUsdc(amounts[w.worker_address] ?? "0"),
      startTs: BigInt(startTs),
      endTs: BigInt(endTs),
      cliffTs: BigInt(cliffTs),
      metadataHash:
        "0x0000000000000000000000000000000000000000000000000000000000000000",
    }));

    const client = createPublicClient({ chain: arcTestnet, transport: http() });

    try {
      // Step 1 — Approve USDC
      setTxStep("approving");
      const approveHash = await writeContractAsync({
        address: ARC_USDC_ADDRESS,
        abi: ERC20_APPROVE_ABI,
        functionName: "approve",
        args: [PAYROLL_STREAM_ADDRESS, totalUsdc],
      });

      setTxStep("approve-wait");
      await client.waitForTransactionReceipt({ hash: approveHash });

      // Step 2 — Create stream(s)
      setTxStep("creating");
      const createHash =
        params.length === 1
          ? await writeContractAsync({
              address: PAYROLL_STREAM_ADDRESS,
              abi: PAYROLL_STREAM_ABI,
              functionName: "createStream",
              args: [params[0]],
            })
          : await writeContractAsync({
              address: PAYROLL_STREAM_ADDRESS,
              abi: PAYROLL_STREAM_ABI,
              functionName: "batchCreate",
              args: [params],
            });

      setTxStep("create-wait");
      await client.waitForTransactionReceipt({ hash: createHash });

      setTxStep("done");
      addNotification(
        `${selectedWorkers.length} stream${selectedWorkers.length !== 1 ? "s" : ""} created!`,
        "success",
      );
      void navigate("/employer/workforce");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transaction failed";
      setTxError(msg.length > 200 ? msg.slice(0, 200) + "…" : msg);
      setTxStep("idle");
    }
  };

  // ── Overlay labels ────────────────────────────────────────────────────────

  const overlayTitle =
    txStep === "approving"
      ? "Approve USDC in your wallet"
      : txStep === "approve-wait"
        ? "Approving USDC…"
        : txStep === "creating"
          ? "Confirm stream creation"
          : "Creating streams on Arc…";

  const overlaySub =
    txStep === "approving"
      ? `Approve ${totalUsdcFloat.toLocaleString()} USDC for the PayrollStream contract`
      : txStep === "approve-wait"
        ? "Waiting for approval to confirm on Arc"
        : txStep === "creating"
          ? `Review the ${selectedWorkers.length > 1 ? "batch " : ""}stream transaction in your wallet`
          : `Confirming ${selectedWorkers.length} stream${selectedWorkers.length !== 1 ? "s" : ""} on Arc Testnet`;

  const isApprovePhase = txStep === "approving" || txStep === "approve-wait";

  // ── No wallet ─────────────────────────────────────────────────────────────

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
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 12h.01" strokeLinecap="round" />
            <path d="M2 7l10-5 10 5" />
          </svg>
        </div>
        <h2 className="text-[20px] font-bold text-white mb-2">
          Connect your wallet
        </h2>
        <p className="text-[14px] text-neutral-500">
          Connect to create payroll streams.
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <SeoHelmet
        title="Create Streams · Quipay"
        description="Set up payroll streams for your workers on Arc."
        path="/employer/create-stream"
        robots="noindex,nofollow"
      />

      {/* Transaction overlay */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-white/[0.1] bg-[#111] p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-yellow-400/10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" />
            </div>
            <p className="text-[16px] font-bold text-white mb-1">
              {overlayTitle}
            </p>
            <p className="text-[13px] text-neutral-600">{overlaySub}</p>

            {/* Step progress */}
            <div className="mt-5 flex items-center justify-center gap-2">
              <div
                className={`h-1.5 w-14 rounded-full transition-colors ${
                  isApprovePhase ? "bg-yellow-400" : "bg-green-400"
                }`}
              />
              <div
                className={`h-1.5 w-14 rounded-full transition-colors ${
                  !isApprovePhase ? "bg-yellow-400" : "bg-white/10"
                }`}
              />
            </div>
            <p className="mt-2 text-[10px] text-neutral-700">
              {isApprovePhase
                ? "Step 1 of 2 — Approve USDC"
                : "Step 2 of 2 — Create Streams"}
            </p>
          </div>
        </div>
      )}

      <div className="px-6 py-8 sm:px-8 sm:py-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[22px] font-bold text-white tracking-tight">
              Create Payment Streams
            </h1>
            <p className="mt-1 text-[14px] text-neutral-500">
              Select workers, set USDC amounts, and stream payroll on Arc.
            </p>
          </div>
          <button
            onClick={() => void navigate("/employer/workforce")}
            className="shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Tx error */}
        {txError && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-500/20 bg-red-500/[0.06] px-5 py-4">
            <svg
              className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-red-400">
                Transaction failed
              </p>
              <p className="text-[12px] text-red-400/70 mt-0.5 break-all">
                {txError}
              </p>
            </div>
            <button
              onClick={() => setTxError(null)}
              className="shrink-0 text-red-700 hover:text-red-400 transition-colors"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          {/* ── Left: worker list ── */}
          <div className="flex flex-col gap-4">
            {/* Loading */}
            {isLoadingWorkers && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-10 text-center">
                <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" />
                <p className="mt-3 text-[13px] text-neutral-600">
                  Loading your workforce…
                </p>
              </div>
            )}

            {/* Worker load error */}
            {!isLoadingWorkers && workerError && (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-6 text-center">
                <p className="text-[13px] text-red-400">{workerError}</p>
                <button
                  onClick={() => setWorkerTick((t) => t + 1)}
                  className="mt-3 text-[12px] text-red-400 underline hover:text-red-300"
                >
                  Retry
                </button>
              </div>
            )}

            {/* No workers */}
            {!isLoadingWorkers && !workerError && workers.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0a0a] p-12 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.04]">
                  <svg
                    className="h-7 w-7 text-neutral-700"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <p className="text-[15px] font-bold text-white mb-1">
                  No workers registered
                </p>
                <p className="text-[13px] text-neutral-600 mb-5">
                  Share your invite link so workers can join and register their
                  wallets.
                </p>
                <button
                  onClick={() => void navigate("/employer/workforce")}
                  className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
                >
                  Go to Workforce
                </button>
              </div>
            )}

            {/* Worker checklist */}
            {!isLoadingWorkers && workers.length > 0 && (
              <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] overflow-hidden">
                {/* Table header */}
                <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3">
                  <p className="text-[13px] font-bold text-white">
                    {workers.length} worker
                    {workers.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={bulkAmount}
                        onChange={(e) => setBulkAmount(e.target.value)}
                        placeholder="Bulk amount…"
                        className="w-[130px] rounded-lg border border-white/[0.1] bg-black px-3 py-1.5 text-right text-[12px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-yellow-400/40 transition-colors"
                      />
                      <button
                        onClick={applyBulkAmount}
                        disabled={!bulkAmount || selectedWorkers.length === 0}
                        className="rounded-lg border border-yellow-400/30 bg-yellow-400/10 px-2.5 py-1.5 text-[11px] font-bold text-yellow-400 hover:bg-yellow-400/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        Apply all
                      </button>
                    </div>
                    <button
                      onClick={() => {
                        const allSelected = workers.every(
                          (w) => selected[w.worker_address],
                        );
                        const next: Record<string, boolean> = {};
                        workers.forEach((w) => {
                          next[w.worker_address] = !allSelected;
                        });
                        setSelected(next);
                      }}
                      className="text-[12px] font-semibold transition-colors hover:text-white"
                      style={{ color: "#facc15" }}
                    >
                      {workers.every((w) => selected[w.worker_address])
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                  </div>
                </div>

                {/* Worker rows */}
                <div className="divide-y divide-white/[0.04]">
                  {workers.map((w) => {
                    const isSelected = !!selected[w.worker_address];
                    const amt = amounts[w.worker_address] ?? "";
                    const subtitle =
                      [w.job_title, w.department].filter(Boolean).join(" · ") ||
                      shortAddr(w.worker_address);
                    return (
                      <div
                        key={w.worker_address}
                        className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                          isSelected ? "bg-yellow-400/[0.02]" : "opacity-50"
                        }`}
                      >
                        {/* Checkbox */}
                        <button
                          onClick={() => toggleWorker(w.worker_address)}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                            isSelected
                              ? "border-yellow-400/60 bg-yellow-400/20"
                              : "border-white/[0.15] bg-transparent"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              className="h-3 w-3 text-yellow-400"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="3"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>

                        {/* Avatar */}
                        <div
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-black text-black"
                          style={{
                            backgroundColor: "#facc15",
                            opacity: isSelected ? 1 : 0.5,
                          }}
                        >
                          {getInitials(w.full_name, w.worker_address)}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-white truncate">
                            {w.full_name}
                          </p>
                          <p className="text-[11px] text-neutral-500 truncate">
                            {subtitle}
                          </p>
                          <p className="font-mono text-[10px] text-neutral-700 truncate mt-0.5">
                            {shortAddr(w.worker_address)}
                          </p>
                        </div>

                        {/* Amount input */}
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={amt}
                            disabled={!isSelected}
                            onChange={(e) =>
                              setAmount(w.worker_address, e.target.value)
                            }
                            placeholder="0.00"
                            className={`w-[100px] rounded-xl border bg-black px-3 py-2 text-right text-[13px] text-white placeholder:text-neutral-700 focus:outline-none focus:border-yellow-400/40 focus:ring-1 focus:ring-yellow-400/20 disabled:opacity-30 ${
                              isSelected && parseFloat(amt) <= 0 && amt !== ""
                                ? "border-red-500/40"
                                : "border-white/[0.1]"
                            }`}
                          />
                          <span className="text-[12px] font-semibold text-neutral-600 w-12 shrink-0">
                            USDC
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ── Right: settings + summary ── */}
          <div className="flex flex-col gap-4">
            {/* Stream settings */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
              <p className="mb-4 text-[13px] font-bold text-white">
                Stream Settings
              </p>
              <div className="flex flex-col gap-4">
                {/* Token — fixed USDC */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                    Token
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-white/[0.1] bg-black px-4 py-2.5">
                    <div className="h-2 w-2 rounded-full bg-green-400 shrink-0" />
                    <span className="text-[13px] font-semibold text-white">
                      USDC
                    </span>
                    <span className="ml-auto font-mono text-[11px] text-neutral-700">
                      Arc Testnet
                    </span>
                  </div>
                </div>

                {/* Start date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                    Start Date <span style={{ color: "#facc15" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      setStartDate(e.target.value);
                      if (!cliffDate) setCliffDate(e.target.value);
                    }}
                    className="w-full rounded-xl border border-white/[0.1] bg-black px-4 py-2.5 text-[13px] text-white focus:border-yellow-400/40 focus:outline-none [color-scheme:dark]"
                  />
                </div>

                {/* Cliff date */}
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                      Cliff Date
                    </label>
                    <span className="text-[10px] text-neutral-600">
                      No withdrawals before
                    </span>
                  </div>
                  <input
                    type="date"
                    value={cliffDate}
                    min={startDate}
                    max={endDate}
                    onChange={(e) => setCliffDate(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.1] bg-black px-4 py-2.5 text-[13px] text-white focus:border-yellow-400/40 focus:outline-none [color-scheme:dark]"
                  />
                </div>

                {/* End date */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">
                    End Date <span style={{ color: "#facc15" }}>*</span>
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    min={startDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-white/[0.1] bg-black px-4 py-2.5 text-[13px] text-white focus:border-yellow-400/40 focus:outline-none [color-scheme:dark]"
                  />
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
              <p className="mb-4 text-[13px] font-bold text-white">Summary</p>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between">
                  <span className="text-[13px] text-neutral-500">Workers</span>
                  <span className="text-[13px] font-semibold text-white">
                    {selectedWorkers.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[13px] text-neutral-500">
                    Total USDC
                  </span>
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: "#facc15" }}
                  >
                    {totalUsdcFloat.toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {durDays > 0 && (
                  <div className="flex justify-between">
                    <span className="text-[13px] text-neutral-500">
                      Duration
                    </span>
                    <span className="text-[13px] font-semibold text-white">
                      {durDays} days
                    </span>
                  </div>
                )}
                {cliffDate &&
                  startDate &&
                  cliffDate !== startDate &&
                  durDays > 0 && (
                    <div className="flex justify-between">
                      <span className="text-[13px] text-neutral-500">
                        Cliff
                      </span>
                      <span className="text-[13px] font-semibold text-white">
                        {Math.round((toUnixSec(cliffDate) - startTs) / 86400)}d
                        lock
                      </span>
                    </div>
                  )}
                {totalUsdcFloat > 0 &&
                  durDays > 0 &&
                  selectedWorkers.length > 0 && (
                    <>
                      <div className="my-1 h-px bg-white/[0.06]" />
                      <div className="flex justify-between">
                        <span className="text-[13px] text-neutral-500">
                          Per worker / day
                        </span>
                        <span className="text-[13px] font-semibold text-white">
                          {(
                            totalUsdcFloat /
                            selectedWorkers.length /
                            durDays
                          ).toLocaleString(undefined, {
                            maximumFractionDigits: 4,
                          })}{" "}
                          USDC
                        </span>
                      </div>
                    </>
                  )}
              </div>

              {missingAmounts.length > 0 && (
                <p className="mt-3 text-[11px] text-yellow-400/70">
                  {missingAmounts.length === 1
                    ? `Enter an amount for ${
                        missingAmounts[0].full_name ||
                        shortAddr(missingAmounts[0].worker_address)
                      }.`
                    : `Enter amounts for ${missingAmounts.length} workers.`}
                </p>
              )}

              {/* Two-step hint */}
              <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                <p className="text-[11px] text-neutral-600 leading-relaxed">
                  Two transactions: approve USDC, then create streams. USDC
                  transfers directly into the contract at creation.
                </p>
              </div>

              <div className="mt-4">
                <button
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || isSubmitting}
                  className="w-full rounded-xl py-3 text-[14px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#facc15" }}
                >
                  Create{" "}
                  {selectedWorkers.length > 0
                    ? `${selectedWorkers.length} `
                    : ""}
                  Stream{selectedWorkers.length !== 1 ? "s" : ""}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateStream;
