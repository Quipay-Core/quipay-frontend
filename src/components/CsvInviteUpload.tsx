/**
 * CsvInviteUpload
 * ────────────────
 * Full CSV upload flow for bulk invite creation:
 * 1. Upload CSV file (drag-and-drop or click)
 * 2. Preview matched/new/error rows
 * 3. Confirm and create invites
 */

import { useState, useCallback, useRef } from "react";
import { useWallet } from "../hooks/useWallet";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CsvRow {
  email?: string;
  worker_address?: string;
  amount?: string;
  purpose?: string;
  lineNumber: number;
}

interface CsvPreviewRow extends CsvRow {
  status: "valid" | "new_invite" | "error";
  error?: string;
  matchedEmployee?: string;
}

interface PreviewResponse {
  rows: CsvPreviewRow[];
  summary: {
    total: number;
    valid: number;
    errors: number;
    newInvites: number;
    matched: number;
  };
}

interface CreateResponse {
  results: Array<{
    row: CsvRow;
    success: boolean;
    token?: string;
    link?: string;
    error?: string;
  }>;
  summary: {
    total: number;
    success: number;
    failed: number;
  };
}

type Step = "upload" | "preview" | "creating" | "done";

// ─── Component ────────────────────────────────────────────────────────────────

export default function CsvInviteUpload({
  onComplete,
  onCancel,
}: {
  onComplete?: () => void;
  onCancel?: () => void;
}) {
  const { address } = useWallet();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [createResult, setCreateResult] = useState<CreateResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // ── Upload and preview ──────────────────────────────────────────────────────

  const handleFile = useCallback(
    async (file: File) => {
      if (!address) return;

      setError(null);
      setFileName(file.name);
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch(`${API_BASE}/invites/csv/preview`, {
          method: "POST",
          headers: {
            "x-user-id": address,
            "x-user-role": "user",
          },
          body: formData,
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Upload failed (${res.status})`,
          );
        }

        const data = (await res.json()) as PreviewResponse;
        setPreview(data);
        setStep("preview");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [address],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  // ── Create invites ──────────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!address || !preview) return;

    setError(null);
    setStep("creating");

    // Filter to valid rows only
    const validRows = preview.rows
      .filter((r) => r.status === "valid" || r.status === "new_invite")
      .map((r) => ({
        email: r.email,
        worker_address: r.worker_address,
        amount: r.amount,
        purpose: r.purpose,
      }));

    try {
      const res = await fetch(`${API_BASE}/invites/csv/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": address,
          "x-user-role": "user",
        },
        body: JSON.stringify({ rows: validRows, expiresInDays: 7 }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Creation failed (${res.status})`,
        );
      }

      const data = (await res.json()) as CreateResponse;
      setCreateResult(data);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Creation failed");
      setStep("preview");
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-6">
      {/* ── Upload step ────────────────────────────────────────────────────── */}
      {step === "upload" && (
        <>
          <h3 className="text-[16px] font-bold text-white mb-1">
            Bulk invite via CSV
          </h3>
          <p className="text-[13px] text-neutral-500 mb-5">
            Upload a CSV with columns: <code className="text-yellow-400">email</code>,{" "}
            <code className="text-yellow-400">worker_address</code>,{" "}
            <code className="text-yellow-400">amount</code>,{" "}
            <code className="text-yellow-400">purpose</code>
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 cursor-pointer transition-all ${
              dragOver
                ? "border-yellow-400 bg-yellow-400/[0.05]"
                : "border-white/[0.1] bg-white/[0.02] hover:border-white/[0.2]"
            }`}
          >
            <svg
              className="h-8 w-8 text-neutral-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="text-center">
              <p className="text-[14px] font-semibold text-white">
                {uploading ? "Uploading…" : "Drop CSV here or click to browse"}
              </p>
              <p className="text-[12px] text-neutral-600 mt-1">
                Max 500 rows, 512KB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>

          <div className="mt-4 flex items-center justify-between">
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                // Download template CSV
                const template =
                  "email,worker_address,amount,purpose\nworker@example.com,,5000000000,Monthly salary\n,john@company.com,3000000000,Freelance design\n";
                const blob = new Blob([template], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "quipay-invite-template.csv";
                a.click();
                URL.revokeObjectURL(url);
              }}
              className="text-[12px] text-yellow-400 hover:underline"
            >
              Download template ↗
            </a>
            {onCancel && (
              <button
                onClick={onCancel}
                className="text-[13px] text-neutral-500 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Preview step ───────────────────────────────────────────────────── */}
      {step === "preview" && preview && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-[16px] font-bold text-white mb-1">
                Preview — {fileName}
              </h3>
              <p className="text-[13px] text-neutral-500">
                Review the rows below before creating invites.
              </p>
            </div>
            <button
              onClick={() => {
                setStep("upload");
                setPreview(null);
                setFileName(null);
              }}
              className="text-[12px] text-neutral-500 hover:text-white transition-colors"
            >
              ← Back
            </button>
          </div>

          {/* Summary badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11px] font-bold text-neutral-400">
              {preview.summary.total} rows
            </span>
            {preview.summary.matched > 0 && (
              <span className="rounded-full bg-green-500/10 px-3 py-1 text-[11px] font-bold text-green-400 border border-green-500/20">
                {preview.summary.matched} matched
              </span>
            )}
            {preview.summary.newInvites > 0 && (
              <span className="rounded-full bg-yellow-400/10 px-3 py-1 text-[11px] font-bold text-yellow-400 border border-yellow-400/20">
                {preview.summary.newInvites} new invites
              </span>
            )}
            {preview.summary.errors > 0 && (
              <span className="rounded-full bg-red-500/10 px-3 py-1 text-[11px] font-bold text-red-400 border border-red-500/20">
                {preview.summary.errors} errors
              </span>
            )}
          </div>

          {/* Rows table */}
          <div className="max-h-[320px] overflow-y-auto rounded-xl border border-white/[0.06] mb-4">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-[#0d0d0d]">
                <tr className="border-b border-white/[0.06]">
                  <th className="px-3 py-2 text-left text-neutral-600 font-bold uppercase tracking-widest">
                    #
                  </th>
                  <th className="px-3 py-2 text-left text-neutral-600 font-bold uppercase tracking-widest">
                    Email / Wallet
                  </th>
                  <th className="px-3 py-2 text-left text-neutral-600 font-bold uppercase tracking-widest">
                    Amount
                  </th>
                  <th className="px-3 py-2 text-left text-neutral-600 font-bold uppercase tracking-widest">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-white/[0.03] hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2 text-neutral-600">
                      {row.lineNumber}
                    </td>
                    <td className="px-3 py-2 text-white font-mono text-[11px]">
                      {row.email ?? row.worker_address ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-neutral-400">
                      {row.amount
                        ? `${(Number(BigInt(row.amount)) / 1e6).toLocaleString()} USDC`
                        : "—"}
                    </td>
                    <td className="px-3 py-2">
                      {row.status === "valid" && (
                        <span className="text-green-400">✓ Matched</span>
                      )}
                      {row.status === "new_invite" && (
                        <span className="text-yellow-400">⚡ New invite</span>
                      )}
                      {row.status === "error" && (
                        <span className="text-red-400" title={row.error}>
                          ✗ {row.error}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {error && (
            <p className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[12px] text-red-400">
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setStep("upload");
                setPreview(null);
                setFileName(null);
              }}
              className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => void handleCreate()}
              disabled={preview.summary.valid === 0}
              className="flex-1 rounded-xl py-3 text-[13px] font-bold text-black transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#facc15" }}
            >
              Create {preview.summary.valid} invite
              {preview.summary.valid !== 1 ? "s" : ""}
            </button>
          </div>
        </>
      )}

      {/* ── Creating step ──────────────────────────────────────────────────── */}
      {step === "creating" && (
        <div className="flex flex-col items-center py-8">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
          <p className="text-[14px] text-white font-medium">
            Creating invites…
          </p>
          <p className="text-[12px] text-neutral-500 mt-1">
            This may take a moment for large batches.
          </p>
        </div>
      )}

      {/* ── Done step ──────────────────────────────────────────────────────── */}
      {step === "done" && createResult && (
        <>
          <div className="text-center mb-5">
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
              Invites created!
            </h3>
            <p className="text-[13px] text-neutral-500">
              {createResult.summary.success} invite
              {createResult.summary.success !== 1 ? "s" : ""} sent
              {createResult.summary.failed > 0 &&
                ` (${createResult.summary.failed} failed)`}
            </p>
          </div>

          {/* Show any failures */}
          {createResult.summary.failed > 0 && (
            <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/[0.04] p-4">
              <p className="text-[12px] font-bold text-red-400 mb-2">
                Failed rows:
              </p>
              {createResult.results
                .filter((r) => !r.success)
                .map((r, i) => (
                  <p key={i} className="text-[11px] text-red-400/80">
                    Row {r.row.lineNumber}: {r.error}
                  </p>
                ))}
            </div>
          )}

          <button
            onClick={() => {
              onComplete?.();
              setStep("upload");
              setPreview(null);
              setCreateResult(null);
              setFileName(null);
            }}
            className="w-full rounded-xl py-3 text-[13px] font-bold text-black transition-all hover:opacity-90"
            style={{ backgroundColor: "#facc15" }}
          >
            Done
          </button>
        </>
      )}
    </div>
  );
}
