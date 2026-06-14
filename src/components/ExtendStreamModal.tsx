/**
 * ExtendStreamModal
 * ─────────────────
 * Modal for extending, topping up, or modifying rate of an active stream.
 * Three modes: Top Up, Extend Duration, Modify Rate.
 */

import { useState, useMemo } from "react";
import { useExtendStream } from "../hooks/useStreamActions";

interface StreamInfo {
  stream_id: number;
  total_amount: string;
  end_ts: number;
  start_ts: number;
  status: string;
  worker_address: string;
}

type Mode = "topup" | "extend" | "rate";

export default function ExtendStreamModal({
  isOpen,
  onClose,
  stream,
}: {
  isOpen: boolean;
  onClose: () => void;
  stream: StreamInfo;
}) {
  const { extendStream, isLoading } = useExtendStream();
  const [mode, setMode] = useState<Mode>("topup");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("");
  const [newRatePerMonth, setNewRatePerMonth] = useState("");

  const currentTotal = useMemo(
    () => Number(BigInt(stream.total_amount)) / 1e6,
    [stream.total_amount],
  );

  const currentDurationDays = useMemo(
    () => Math.floor((stream.end_ts - stream.start_ts) / 86400),
    [stream.end_ts, stream.start_ts],
  );

  const currentRatePerMonth = useMemo(() => {
    const durationSec = stream.end_ts - stream.start_ts;
    if (durationSec <= 0) return 0;
    const ratePerSec = Number(BigInt(stream.total_amount)) / durationSec;
    return (ratePerSec * 30 * 86400) / 1e6;
  }, [stream.total_amount, stream.start_ts, stream.end_ts]);

  // Preview calculations
  const preview = useMemo(() => {
    if (mode === "topup" && amount) {
      const addUsdc = parseFloat(amount);
      const newTotal = currentTotal + addUsdc;
      const durationSec = stream.end_ts - stream.start_ts;
      const newRate = (newTotal * 1e6) / durationSec / 86400 / 30;
      return {
        newTotal: newTotal.toLocaleString(),
        newRate: newRate.toFixed(2),
        newEndDate: new Date(stream.end_ts * 1000).toLocaleDateString(),
        additionalAmount: Math.round(addUsdc * 1e6).toString(),
      };
    }
    if (mode === "extend" && days) {
      const addDays = parseInt(days, 10);
      const newEndTs = stream.end_ts + addDays * 86400;
      const newRate = currentTotal / ((newEndTs - stream.start_ts) / 86400 / 30);
      return {
        newTotal: currentTotal.toLocaleString(),
        newRate: newRate.toFixed(2),
        newEndDate: new Date(newEndTs * 1000).toLocaleDateString(),
        newEndTime: newEndTs,
      };
    }
    if (mode === "rate" && newRatePerMonth) {
      const targetRatePerMonth = parseFloat(newRatePerMonth);
      const durationSec = stream.end_ts - stream.start_ts;
      const targetTotal = (targetRatePerMonth * 1e6 * durationSec) / (30 * 86400);
      const additional = targetTotal - currentTotal * 1e6;
      return {
        newTotal: (targetTotal / 1e6).toLocaleString(),
        newRate: targetRatePerMonth.toFixed(2),
        newEndDate: new Date(stream.end_ts * 1000).toLocaleDateString(),
        additionalAmount:
          additional > 0 ? Math.round(additional).toString() : "0",
      };
    }
    return null;
  }, [mode, amount, days, newRatePerMonth, currentTotal, stream, currentRatePerMonth]);

  if (!isOpen) return null;

  const handleSubmit = async () => {
    const params: Record<string, unknown> = {};

    if (mode === "topup" && amount) {
      params.additionalAmount = Math.round(
        parseFloat(amount) * 1e6,
      ).toString();
    } else if (mode === "extend" && days) {
      params.newEndTime = stream.end_ts + parseInt(days, 10) * 86400;
    } else if (mode === "rate" && newRatePerMonth) {
      params.newRate = (
        (parseFloat(newRatePerMonth) * 1e6) /
        (30 * 86400)
      ).toString();
    } else {
      return;
    }

    const result = await extendStream(stream.stream_id, params);
    if (result) {
      onClose();
      setAmount("");
      setDays("");
      setNewRatePerMonth("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#0a0a0a] p-6">
        <h3 className="text-[18px] font-bold text-white mb-1">
          Manage stream
        </h3>
        <p className="text-[13px] text-neutral-500 mb-5">
          Current rate: ${currentRatePerMonth.toFixed(2)}/month · Total: $
          {currentTotal.toLocaleString()} USDC
        </p>

        {/* Mode tabs */}
        <div className="flex gap-1 mb-5 rounded-xl bg-white/[0.03] p-1">
          {[
            { key: "topup" as Mode, label: "Top Up" },
            { key: "extend" as Mode, label: "Extend" },
            { key: "rate" as Mode, label: "Change Rate" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setMode(tab.key)}
              className={`flex-1 rounded-lg py-2 text-[12px] font-bold transition-colors ${
                mode === tab.key
                  ? "bg-yellow-400 text-black"
                  : "text-neutral-500 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Top Up */}
        {mode === "topup" && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
              Additional amount (USDC)
            </label>
            <input
              type="number"
              placeholder="e.g. 1000"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder-neutral-700 focus:border-yellow-400/50 focus:outline-none transition-colors"
            />
            <p className="mt-2 text-[11px] text-neutral-600">
              Adds funds to the stream. Rate increases, end date stays the same.
            </p>
          </div>
        )}

        {/* Extend Duration */}
        {mode === "extend" && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
              Extend by (days)
            </label>
            <input
              type="number"
              placeholder="e.g. 30"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder-neutral-700 focus:border-yellow-400/50 focus:outline-none transition-colors"
            />
            <p className="mt-2 text-[11px] text-neutral-600">
              Extends the stream duration. Rate decreases, total stays the same.
            </p>
          </div>
        )}

        {/* Modify Rate */}
        {mode === "rate" && (
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
              New rate (USDC/month)
            </label>
            <input
              type="number"
              placeholder="e.g. 6000"
              value={newRatePerMonth}
              onChange={(e) => setNewRatePerMonth(e.target.value)}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder-neutral-700 focus:border-yellow-400/50 focus:outline-none transition-colors"
            />
            <p className="mt-2 text-[11px] text-neutral-600">
              Sets a new monthly rate. May require additional funds.
            </p>
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
              Preview
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[12px]">
                <span className="text-neutral-500">New rate</span>
                <span className="text-white">${preview.newRate}/month</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-neutral-500">New total</span>
                <span className="text-white">${preview.newTotal} USDC</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-neutral-500">End date</span>
                <span className="text-white">{preview.newEndDate}</span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] py-3 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={isLoading || !preview}
            className="flex-1 rounded-xl py-3 text-[13px] font-bold text-black transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#facc15" }}
          >
            {isLoading ? "Updating…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
