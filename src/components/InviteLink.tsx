import React, { useState } from "react";
import { useWallet } from "../hooks/useWallet";

export default function InviteLink() {
  const { address } = useWallet();
  const [copied, setCopied] = useState(false);

  if (!address) return null;

  const inviteUrl = `${window.location.origin}/join?employer=${address}`;

  const handleCopy = () => {
    void navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[14px] font-bold text-white">Invite employees</p>
          <p className="text-[12px] text-neutral-500 mt-0.5">
            Share this link so workers can connect and view their streams.
          </p>
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10">
          <svg
            className="h-4 w-4 text-yellow-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <span className="flex-1 truncate font-mono text-[11px] text-neutral-500">
          {inviteUrl}
        </span>
        <button
          onClick={handleCopy}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
            copied
              ? "bg-green-500/20 text-green-400"
              : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
          }`}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>

      <p className="mt-2.5 text-[11px] text-neutral-700">
        Workers who open this link will see only their streams from your
        address.
      </p>
    </div>
  );
}
