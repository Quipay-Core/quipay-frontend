/**
 * PayrollCreate page
 * ───────────────────
 * Wizard for creating a payroll group:
 * 1. Select workers and set amounts
 * 2. Review and confirm
 * 3. Created
 */

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useOrg } from "../context/OrgContext";
import { usePayrolls } from "../hooks/usePayrolls";
import { usePayrollTemplates } from "../hooks/usePayrolls";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface WorkerRow {
  worker_address: string;
  full_name: string;
  job_title: string;
}

interface PayrollEntry {
  workerAddress: string;
  fullName: string;
  amount: string; // in USDC (human-readable)
  selected: boolean;
}

type Step = "select" | "review" | "creating" | "done";

const PayrollCreate: React.FC = () => {
  const navigate = useNavigate();
  const { address } = useWallet();
  const { activeOrg } = useOrg();
  const { createPayroll } = usePayrolls(activeOrg?.orgId);
  const { templates, saveTemplate } = usePayrollTemplates(activeOrg?.orgId);

  const [step, setStep] = useState<Step>("select");
  const [payrollName, setPayrollName] = useState("");
  const [entries, setEntries] = useState<PayrollEntry[]>([]);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdPayrollId, setCreatedPayrollId] = useState<number | null>(null);
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Fetch employees
  useEffect(() => {
    if (!address) return;

    let cancelled = false;
    const fetchWorkers = async () => {
      setWorkersLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/employers/employees`, {
          headers: { "x-user-id": address, "x-user-role": "user" },
        });

        if (!res.ok) return;
        const data = (await res.json()) as { employees?: WorkerRow[] };
        if (cancelled) return;

        setEntries(
          (data.employees ?? []).map((w) => ({
            workerAddress: w.worker_address,
            fullName: w.full_name,
            amount: "",
            selected: false,
          })),
        );
      } catch {
        // Fail silently
      } finally {
        if (!cancelled) setWorkersLoading(false);
      }
    };

    void fetchWorkers();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const selectedEntries = useMemo(
    () => entries.filter((e) => e.selected && e.amount),
    [entries],
  );

  const totalAmount = useMemo(
    () =>
      selectedEntries.reduce(
        (sum, e) => sum + parseFloat(e.amount || "0") * 1e6,
        0,
      ),
    [selectedEntries],
  );

  const toggleEntry = (idx: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, selected: !e.selected } : e)),
    );
  };

  const updateAmount = (idx: number, amount: string) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, amount } : e)),
    );
  };

  const loadTemplate = (templateIdx: number) => {
    const template = templates[templateIdx];
    if (!template) return;

    setEntries((prev) => {
      const updated = [...prev];
      for (const item of template.template_json) {
        const idx = updated.findIndex(
          (e) => e.workerAddress === item.workerAddress,
        );
        if (idx >= 0) {
          updated[idx] = {
            ...updated[idx],
            amount: (Number(BigInt(item.amount)) / 1e6).toString(),
            selected: true,
          };
        }
      }
      return updated;
    });
  };

  const handleCreate = async () => {
    if (!activeOrg || !payrollName.trim()) return;

    setError(null);
    setStep("creating");

    const result = await createPayroll({
      orgId: activeOrg.orgId,
      name: payrollName.trim(),
      entries: selectedEntries.map((e) => ({
        workerAddress: e.workerAddress,
        amount: Math.round(parseFloat(e.amount) * 1e6).toString(),
      })),
    });

    if (result) {
      // Save as template if requested
      if (saveAsTemplate && templateName.trim()) {
        await saveTemplate({
          orgId: activeOrg.orgId,
          name: templateName.trim(),
          entries: selectedEntries.map((e) => ({
            workerAddress: e.workerAddress,
            amount: Math.round(parseFloat(e.amount) * 1e6).toString(),
          })),
        });
      }

      setCreatedPayrollId(result.id);
      setStep("done");
    } else {
      setError("Failed to create payroll");
      setStep("review");
    }
  };

  return (
    <div className="px-6 py-8 sm:px-8 sm:py-10 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => void navigate("/employer/payrolls")}
          className="text-[12px] text-neutral-500 hover:text-white transition-colors mb-3"
        >
          ← Back to payrolls
        </button>
        <h1 className="text-[24px] font-bold text-white tracking-tight">
          Create payroll
        </h1>
        <p className="mt-1 text-[14px] text-neutral-500">
          Select workers, set amounts, and create streams in one batch.
        </p>
      </div>

      {/* ── Step 1: Select workers ──────────────────────────────────────── */}
      {step === "select" && (
        <>
          {/* Payroll name */}
          <div className="mb-6">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
              Payroll name
            </label>
            <input
              type="text"
              placeholder="e.g. January 2026 Salary"
              value={payrollName}
              onChange={(e) => setPayrollName(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder-neutral-700 focus:border-yellow-400/50 focus:outline-none transition-colors"
            />
          </div>

          {/* Load template */}
          {templates.length > 0 && (
            <div className="mb-6">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
                Load template
              </label>
              <div className="flex flex-wrap gap-2">
                {templates.map((t, i) => (
                  <button
                    key={t.id}
                    onClick={() => loadTemplate(i)}
                    className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-[12px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
                  >
                    {t.name} ({t.template_json.length} workers)
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Worker list */}
          <div className="mb-6">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
              Select workers and set amounts
            </label>

            {workersLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-16 animate-pulse rounded-xl bg-white/[0.04]"
                  />
                ))}
              </div>
            ) : entries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/[0.08] p-8 text-center">
                <p className="text-[13px] text-neutral-500">
                  No workers found. Add workers on the Workforce page first.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {entries.map((entry, idx) => (
                  <div
                    key={entry.workerAddress}
                    className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                      entry.selected
                        ? "border-yellow-400/30 bg-yellow-400/[0.03]"
                        : "border-white/[0.06] bg-white/[0.02]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={entry.selected}
                      onChange={() => toggleEntry(idx)}
                      className="h-4 w-4 rounded accent-yellow-400"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-white truncate">
                        {entry.fullName}
                      </p>
                      <p className="text-[11px] text-neutral-600 font-mono truncate">
                        {entry.workerAddress.slice(0, 8)}…
                        {entry.workerAddress.slice(-6)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        placeholder="0"
                        value={entry.amount}
                        onChange={(e) => updateAmount(idx, e.target.value)}
                        disabled={!entry.selected}
                        className="w-24 rounded-lg border border-white/[0.08] bg-white/[0.03] px-2.5 py-1.5 text-[13px] text-white text-right placeholder-neutral-700 focus:border-yellow-400/50 focus:outline-none transition-colors disabled:opacity-30"
                      />
                      <span className="text-[11px] text-neutral-500">USDC</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary + next */}
          <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-3.5">
            <div>
              <p className="text-[12px] text-neutral-500">
                {selectedEntries.length} worker
                {selectedEntries.length !== 1 ? "s" : ""} selected
              </p>
              <p className="text-[18px] font-bold text-white">
                {(totalAmount / 1e6).toLocaleString()} USDC
              </p>
            </div>
            <button
              onClick={() => setStep("review")}
              disabled={selectedEntries.length === 0 || !payrollName.trim()}
              className="rounded-xl px-6 py-3 text-[13px] font-bold text-black transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#facc15" }}
            >
              Review →
            </button>
          </div>
        </>
      )}

      {/* ── Step 2: Review ──────────────────────────────────────────────── */}
      {step === "review" && (
        <>
          <div className="mb-6 rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
            <h3 className="text-[16px] font-bold text-white mb-4">
              {payrollName}
            </h3>

            <div className="space-y-2 mb-4">
              {selectedEntries.map((entry) => (
                <div
                  key={entry.workerAddress}
                  className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0"
                >
                  <div>
                    <p className="text-[13px] text-white">{entry.fullName}</p>
                    <p className="text-[11px] text-neutral-600 font-mono">
                      {entry.workerAddress.slice(0, 8)}…
                      {entry.workerAddress.slice(-6)}
                    </p>
                  </div>
                  <p className="text-[14px] font-semibold text-white">
                    {parseFloat(entry.amount).toLocaleString()} USDC
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
              <p className="text-[14px] font-bold text-neutral-400">Total</p>
              <p className="text-[20px] font-bold text-white">
                {(totalAmount / 1e6).toLocaleString()} USDC
              </p>
            </div>
          </div>

          {/* Save as template */}
          <div className="mb-6 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                className="h-4 w-4 rounded accent-yellow-400"
              />
              <span className="text-[13px] text-white">
                Save as template for future use
              </span>
            </label>
            {saveAsTemplate && (
              <input
                type="text"
                placeholder="Template name"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                className="mt-3 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[13px] text-white placeholder-neutral-700 focus:border-yellow-400/50 focus:outline-none transition-colors"
              />
            )}
          </div>

          {error && (
            <p className="mb-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[12px] text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setStep("select")}
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
            >
              ← Back
            </button>
            <button
              onClick={() => void handleCreate()}
              className="flex-1 rounded-xl py-3 text-[13px] font-bold text-black transition-all hover:opacity-90"
              style={{ backgroundColor: "#facc15" }}
            >
              Create payroll
            </button>
          </div>
        </>
      )}

      {/* ── Step 3: Creating ────────────────────────────────────────────── */}
      {step === "creating" && (
        <div className="flex flex-col items-center py-16">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
          <p className="text-[14px] text-white font-medium">
            Creating payroll…
          </p>
        </div>
      )}

      {/* ── Step 4: Done ────────────────────────────────────────────────── */}
      {step === "done" && (
        <div className="text-center py-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10 ring-1 ring-green-500/20">
            <svg
              className="h-6 w-6 text-green-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h3 className="text-[18px] font-bold text-white mb-2">
            Payroll created!
          </h3>
          <p className="text-[13px] text-neutral-500 mb-6">
            {selectedEntries.length} stream
            {selectedEntries.length !== 1 ? "s" : ""} created with a total of{" "}
            {(totalAmount / 1e6).toLocaleString()} USDC.
          </p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => void navigate("/employer/payrolls")}
              className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-6 py-3 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
            >
              All payrolls
            </button>
            {createdPayrollId && (
              <button
                onClick={() =>
                  void navigate(`/employer/payrolls/${createdPayrollId}`)
                }
                className="rounded-xl px-6 py-3 text-[13px] font-bold text-black transition-all hover:opacity-90"
                style={{ backgroundColor: "#facc15" }}
              >
                View payroll
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollCreate;
