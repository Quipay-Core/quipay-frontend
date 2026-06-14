import { useEffect, useState } from "react";
import { useSearchParams, useParams, Link, useNavigate } from "react-router-dom";
import { kit } from "../util/wallet";
import { useWallet } from "../hooks/useWallet";
import { useRole } from "../context/RoleContext";
import { getStreamsByWorker, getStreamById } from "../contracts/payroll_stream";
import { formatUsdc } from "../contracts/util";
import {
  getInviteByToken,
  acceptInvite,
  type InviteDetails,
} from "../hooks/useInvites";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

function shortAddr(a: string) {
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function StatusBadge({ status }: { status: number }) {
  if (status === 0)
    return (
      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-green-500/10 text-green-400 border border-green-500/20">
        Streaming
      </span>
    );
  if (status === 4)
    return (
      <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-yellow-400/10 text-yellow-400 border border-yellow-400/20">
        Paused
      </span>
    );
  return (
    <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-white/[0.04] text-neutral-500 border border-white/[0.06]">
      Ended
    </span>
  );
}

interface StreamRow {
  id: bigint;
  totalAmount: bigint;
  withdrawnAmount: bigint;
  startTs: bigint;
  endTs: bigint;
  status: number;
}

type PageState =
  | "idle"
  | "loading"
  | "has_streams"
  | "no_streams"
  | "register_form"
  | "registered"
  | "invite_accepted"
  | "invite_expired"
  | "invite_error";

// Stellar address: G followed by 55 base32 chars [A-Z2-7]
const STELLAR_ADDR_RE = /^G[A-Z2-7]{55}$/;

export default function JoinPage() {
  // Support both /join/:token (new) and /join?employer=... (legacy)
  const { token: tokenParam } = useParams<{ token?: string }>();
  const [searchParams] = useSearchParams();
  const employerParam = searchParams.get("employer") ?? "";
  const navigate = useNavigate();

  const { address } = useWallet();
  const { addRole } = useRole();

  const [streams, setStreams] = useState<StreamRow[]>([]);
  const [pageState, setPageState] = useState<PageState>("idle");
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState<string | null>(null);

  // Determine mode: token-based or legacy
  const isTokenMode = Boolean(tokenParam);
  const employerAddress = isTokenMode
    ? inviteDetails?.employerAddress ?? ""
    : employerParam;
  const isValidEmployer = STELLAR_ADDR_RE.test(employerAddress);

  // ── Fetch invite details (token mode) ───────────────────────────────────────
  useEffect(() => {
    if (!tokenParam) return;

    let cancelled = false;
    const fetchInvite = async () => {
      setInviteLoading(true);
      const details = await getInviteByToken(tokenParam);
      if (cancelled) return;

      if (!details) {
        setPageState("invite_error");
      } else if (details.status === "expired") {
        setPageState("invite_expired");
      } else {
        setInviteDetails(details);
      }
      setInviteLoading(false);
    };

    fetchInvite();
    return () => {
      cancelled = true;
    };
  }, [tokenParam]);

  // ── Check for existing streams (legacy mode or after invite loaded) ─────────
  useEffect(() => {
    const run = async () => {
      if (!address || !isValidEmployer) {
        setPageState(address && isTokenMode && inviteDetails ? "no_streams" : "idle");
        return;
      }
      setPageState("loading");
      try {
        const ids = await getStreamsByWorker(address);
        const all = await Promise.all(
          ids.map(async (id) => {
            const s = await getStreamById(id);
            return s && s.employer === employerAddress ? { id, ...s } : null;
          }),
        );
        const found = all.filter(Boolean) as StreamRow[];
        setStreams(found);
        setPageState(found.length > 0 ? "has_streams" : "no_streams");
      } catch {
        setStreams([]);
        setPageState("no_streams");
      }
    };
    void run();
  }, [address, employerAddress, isValidEmployer, isTokenMode, inviteDetails]);

  // ── Accept invite (token mode) ─────────────────────────────────────────────
  async function handleAcceptInvite() {
    if (!tokenParam || !address) return;
    setRegistering(true);
    setRegisterError(null);

    const result = await acceptInvite(
      tokenParam,
      address,
      fullName.trim() || undefined,
      jobTitle.trim() || undefined,
    );

    if (result.success) {
      // Add worker role to context so WalletGuard doesn't redirect
      addRole("worker");
      setPageState("invite_accepted");
    } else {
      setRegisterError(result.error ?? "Failed to accept invite");
    }

    setRegistering(false);
  }

  // ── Register worker (legacy mode) ──────────────────────────────────────────
  async function handleRegister() {
    if (!address || !fullName.trim() || !jobTitle.trim()) return;
    setRegistering(true);
    setRegisterError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/employers/worker-registrations`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workerAddress: address,
            employerAddress,
            fullName: fullName.trim(),
            jobTitle: jobTitle.trim(),
          }),
        },
      );
      if (!res.ok) throw new Error("Registration failed.");
      addRole("worker");
      setPageState("registered");
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setRegistering(false);
    }
  }

  // ── Invalid link ───────────────────────────────────────────────────────────
  if (!isTokenMode && !isValidEmployer) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6">
        <div className="max-w-sm text-center">
          <p className="text-[48px] mb-4">⚠️</p>
          <h1 className="text-[22px] font-bold text-white mb-2">
            Invalid invite link
          </h1>
          <p className="text-[14px] text-neutral-500 mb-6">
            This link is missing or has an invalid employer address. Ask your
            employer to send a new one.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-black"
            style={{ backgroundColor: "#facc15" }}
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  // ── Loading invite details ─────────────────────────────────────────────────
  if (isTokenMode && inviteLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
          <p className="text-[14px] text-neutral-500">
            Loading invite details…
          </p>
        </div>
      </div>
    );
  }

  // ── Invite error ───────────────────────────────────────────────────────────
  if (pageState === "invite_error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6">
        <div className="max-w-sm text-center">
          <p className="text-[48px] mb-4">❌</p>
          <h1 className="text-[22px] font-bold text-white mb-2">
            Invite not found
          </h1>
          <p className="text-[14px] text-neutral-500 mb-6">
            This invite link is invalid or has been removed. Ask your employer
            to send a new one.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-black"
            style={{ backgroundColor: "#facc15" }}
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  // ── Invite expired ─────────────────────────────────────────────────────────
  if (pageState === "invite_expired") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black px-6">
        <div className="max-w-sm text-center">
          <p className="text-[48px] mb-4">⏰</p>
          <h1 className="text-[22px] font-bold text-white mb-2">
            Invite expired
          </h1>
          <p className="text-[14px] text-neutral-500 mb-6">
            This invite link has expired. Ask your employer to send a new one.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-xl px-6 py-3 text-[14px] font-bold text-black"
            style={{ backgroundColor: "#facc15" }}
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-black px-6 py-16">
      <div className="w-full max-w-[480px]">
        {/* Logo + headline */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div
            className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl text-[22px] font-black text-black"
            style={{ backgroundColor: "#facc15" }}
          >
            Q
          </div>
          <h1 className="text-[26px] font-bold text-white tracking-tight">
            {pageState === "has_streams"
              ? "Your payroll streams"
              : pageState === "invite_accepted"
                ? "Invite accepted!"
                : pageState === "registered"
                  ? "You're registered!"
                  : inviteDetails
                    ? `Invited by ${inviteDetails.employerName}`
                    : "You've been invited to Quipay"}
          </h1>
          <p className="mt-2 text-[14px] text-neutral-500 max-w-[360px]">
            {pageState === "has_streams"
              ? "These streams are set up by your employer and pay you automatically over time."
              : pageState === "invite_accepted"
                ? "Your employer has been notified. You'll start earning once they create your stream."
                : pageState === "registered"
                  ? "Your employer will be notified to set up your payroll stream."
                  : inviteDetails
                    ? `${inviteDetails.employerName} wants to stream payments to your wallet — paid every second, withdraw anytime.`
                    : "Quipay lets your employer stream your salary directly to your wallet — paid every second, withdraw anytime."}
          </p>
        </div>

        {/* Employer pill */}
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-white/[0.07] bg-[#0d0d0d] px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-yellow-400/10 flex items-center justify-center shrink-0">
              <svg
                className="h-4 w-4 text-yellow-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600">
                {inviteDetails ? inviteDetails.employerName : "Employer"}
              </p>
              <p className="font-mono text-[13px] text-white">
                {shortAddr(employerAddress)}
              </p>
            </div>
          </div>
          <a
            href={`https://stellar.expert/explorer/testnet/account/${employerAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[12px] text-yellow-400 hover:underline"
          >
            Explorer ↗
          </a>
        </div>

        {/* Invite details card (token mode only) */}
        {inviteDetails && pageState !== "invite_accepted" && (
          <div className="mb-5 rounded-2xl border border-white/[0.06] bg-[#0d0d0d] px-5 py-4">
            {inviteDetails.purpose && (
              <div className="flex items-center justify-between py-2">
                <span className="text-[12px] text-neutral-500">Purpose</span>
                <span className="text-[13px] text-white font-medium">
                  {inviteDetails.purpose}
                </span>
              </div>
            )}
            {inviteDetails.amount && (
              <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
                <span className="text-[12px] text-neutral-500">Amount</span>
                <span className="text-[13px] text-white font-medium">
                  {formatUsdc(BigInt(inviteDetails.amount))}{" "}
                  {inviteDetails.tokenAsset}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between py-2 border-t border-white/[0.04]">
              <span className="text-[12px] text-neutral-500">Expires</span>
              <span className="text-[13px] text-neutral-400">
                {new Date(inviteDetails.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}

        {/* ── IDLE: not connected ───────────────────────────────────────────── */}
        {pageState === "idle" && (
          <>
            <div className="mb-5 rounded-2xl border border-white/[0.06] bg-[#0d0d0d] divide-y divide-white/[0.05]">
              {[
                {
                  icon: "⚡",
                  title: "Paid every second",
                  desc: "Your salary streams continuously — no waiting for pay day.",
                },
                {
                  icon: "🏦",
                  title: "Withdraw anytime",
                  desc: "Pull your earned USDC to your wallet whenever you want.",
                },
                {
                  icon: "🔒",
                  title: "Secured on-chain",
                  desc: "Funds are locked in a smart contract. Once earned, they're yours.",
                },
              ].map((f) => (
                <div key={f.title} className="flex items-start gap-4 px-5 py-4">
                  <span className="text-[20px] mt-0.5 shrink-0">{f.icon}</span>
                  <div>
                    <p className="text-[13px] font-semibold text-white">
                      {f.title}
                    </p>
                    <p className="text-[12px] text-neutral-500 mt-0.5">
                      {f.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => void kit.authModal()}
              className="w-full rounded-2xl py-4 text-[15px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.98]"
              style={{ backgroundColor: "#facc15" }}
            >
              Connect wallet to continue
            </button>
            <p className="mt-3 text-center text-[12px] text-neutral-600">
              Works with Freighter, XBULL, or any Stellar wallet
            </p>
          </>
        )}

        {/* ── LOADING ───────────────────────────────────────────────────────── */}
        {pageState === "loading" && (
          <div className="flex flex-col gap-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-white/[0.04]"
              />
            ))}
            <p className="text-center text-[13px] text-neutral-600 mt-2">
              Checking for your streams…
            </p>
          </div>
        )}

        {/* ── HAS STREAMS ───────────────────────────────────────────────────── */}
        {pageState === "has_streams" && (
          <>
            <div className="flex flex-col gap-3 mb-6">
              {streams.map((s) => (
                <div
                  key={String(s.id)}
                  className="rounded-2xl border border-white/[0.07] bg-[#0d0d0d] px-5 py-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] text-neutral-500 font-mono">
                      Stream #{String(s.id)}
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-[22px] font-bold text-white leading-none">
                        {formatUsdc(s.totalAmount)}{" "}
                        <span className="text-[14px] text-neutral-400 font-normal">
                          USDC
                        </span>
                      </p>
                      <p className="text-[12px] text-neutral-600 mt-1">
                        {formatUsdc(s.withdrawnAmount)} withdrawn
                      </p>
                    </div>
                    <p className="text-[11px] text-neutral-600">
                      ends{" "}
                      {new Date(Number(s.endTs) * 1000).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <Link
              to="/employee/dashboard"
              className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-[15px] font-bold text-black transition-all hover:opacity-90"
              style={{ backgroundColor: "#facc15" }}
            >
              Go to worker dashboard
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </>
        )}

        {/* ── NO STREAMS — prompt to register / accept ──────────────────────── */}
        {pageState === "no_streams" && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d0d] px-6 py-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[28px]">📬</span>
              <div>
                <p className="text-[15px] font-bold text-white">
                  {isTokenMode ? "Accept this invite" : "No stream set up yet"}
                </p>
                <p className="text-[12px] text-neutral-500 mt-0.5">
                  {isTokenMode
                    ? "Connect your wallet and confirm to accept this payment stream."
                    : "Your employer needs your details to create your payroll stream."}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
                Your wallet (auto-filled)
              </p>
              <p className="font-mono text-[12px] text-neutral-300 break-all">
                {address}
              </p>
            </div>

            <div className="flex flex-col gap-3 mb-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
                  Full name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Ada Okafor"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder-neutral-700 focus:border-yellow-400/50 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-neutral-600 mb-1.5">
                  Job title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Software Engineer"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-[14px] text-white placeholder-neutral-700 focus:border-yellow-400/50 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {registerError && (
              <p className="mb-3 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-[12px] text-red-400">
                {registerError}
              </p>
            )}

            <button
              onClick={() =>
                void (isTokenMode ? handleAcceptInvite() : handleRegister())
              }
              disabled={registering}
              className="w-full rounded-xl py-3.5 text-[14px] font-bold text-black transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#facc15" }}
            >
              {registering
                ? "Sending…"
                : isTokenMode
                  ? "Accept invite →"
                  : "Notify my employer →"}
            </button>
            <p className="mt-3 text-center text-[11px] text-neutral-700">
              {isTokenMode
                ? "This will register your wallet with your employer and activate your invite."
                : "This sends your wallet address and details to your employer so they can set up your stream."}
            </p>
          </div>
        )}

        {/* ── INVITE ACCEPTED (token mode) ──────────────────────────────────── */}
        {pageState === "invite_accepted" && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d0d] px-6 py-8 text-center">
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
            <p className="text-[18px] font-bold text-white mb-2">
              You're connected!
            </p>
            <p className="text-[13px] text-neutral-500 mb-6 leading-relaxed">
              {inviteDetails?.employerName ?? "Your employer"} has been
              notified. Once they create your stream, you'll start earning
              in real time.
            </p>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
                What happens next
              </p>
              <ol className="text-[12px] text-neutral-400 space-y-1.5 list-decimal list-inside">
                <li>Your employer creates a payroll stream for your wallet</li>
                <li>You'll see your earnings start flowing on your dashboard</li>
                <li>Withdraw to your wallet anytime</li>
              </ol>
            </div>
            <Link
              to="/employee/dashboard"
              className="flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[14px] font-bold text-black transition-all hover:opacity-90"
              style={{ backgroundColor: "#facc15" }}
            >
              Go to worker dashboard
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}

        {/* ── REGISTERED (legacy mode) ──────────────────────────────────────── */}
        {pageState === "registered" && (
          <div className="rounded-2xl border border-white/[0.07] bg-[#0d0d0d] px-6 py-8 text-center">
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
            <p className="text-[18px] font-bold text-white mb-2">
              Request sent!
            </p>
            <p className="text-[13px] text-neutral-500 mb-6 leading-relaxed">
              Your employer has been notified. Once they create your stream,
              come back to this link and connect your wallet to see your
              earnings.
            </p>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-left mb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-1">
                What happens next
              </p>
              <ol className="text-[12px] text-neutral-400 space-y-1.5 list-decimal list-inside">
                <li>Your employer reviews your request in their dashboard</li>
                <li>They create a payroll stream for your wallet</li>
                <li>You return here and see your earnings start flowing</li>
              </ol>
            </div>
            <button
              onClick={() => setPageState("loading")}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 text-[13px] font-semibold text-white hover:bg-white/[0.08] transition-colors"
            >
              Check again for streams
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
