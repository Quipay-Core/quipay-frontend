import { useState } from "react";
import { useWallet } from "../hooks/useWallet";

interface InviteLinkProps {
  /** If provided, show a token-based invite link instead of the legacy employer-address link. */
  inviteToken?: string;
  /** If provided, show a token-based invite link instead of the legacy employer-address link. */
  inviteLink?: string;
}

export default function InviteLink({
  inviteToken,
  inviteLink,
}: InviteLinkProps) {
  const { address } = useWallet();
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  if (!address) return null;

  // Token-based invite (new flow)
  const isTokenMode = Boolean(inviteToken && inviteLink);
  const link = inviteLink ?? `${window.location.origin}/join?employer=${address}`;
  const code = inviteToken ?? null;

  const handleCopy = (type: "link" | "code", value: string) => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(type);
      setTimeout(() => setCopied(null), 2500);
    });
  };

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0a0a0a] p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-[14px] font-bold text-white">
            {isTokenMode ? "Invite link created" : "Invite employees"}
          </p>
          <p className="text-[12px] text-neutral-500 mt-0.5">
            {isTokenMode
              ? "Share this link or code with your worker to connect them."
              : "Share this link so workers can connect and view their streams."}
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

      {/* Invite link */}
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
        <span className="flex-1 truncate font-mono text-[11px] text-neutral-500">
          {link}
        </span>
        <button
          onClick={() => handleCopy("link", link)}
          className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
            copied === "link"
              ? "bg-green-500/20 text-green-400"
              : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
          }`}
        >
          {copied === "link" ? "✓ Copied" : "Copy"}
        </button>
      </div>

      {/* Invite code (token mode only) */}
      {isTokenMode && code && (
        <div className="mt-3">
          <p className="text-[11px] text-neutral-600 mb-1.5">
            Or tell them this code:
          </p>
          <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="flex-1 font-mono text-[16px] font-bold tracking-widest text-white">
              {code}
            </span>
            <button
              onClick={() => handleCopy("code", code)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-all ${
                copied === "code"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-white/[0.06] text-white hover:bg-white/[0.1]"
              }`}
            >
              {copied === "code" ? "✓ Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <p className="mt-2.5 text-[11px] text-neutral-700">
        {isTokenMode
          ? "The worker will see the invite details and can accept with their Stellar wallet."
          : "Workers who open this link will see only their streams from your address."}
      </p>
    </div>
  );
}
