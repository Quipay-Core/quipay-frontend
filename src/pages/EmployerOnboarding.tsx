import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

const HERO_IMG =
  "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1400&q=85";

interface OnboardResult {
  employer: {
    employer_id: string;
    business_name: string;
    verification_status: "pending" | "verified" | "rejected";
    stellar_address: string;
  };
  status: string;
  chain: {
    evmAddress: string;
    existingStreams: number;
    vaultBalance: number;
  };
}

const COUNTRIES = [
  { code: "NG", label: "Nigeria", flag: "🇳🇬" },
  { code: "US", label: "United States", flag: "🇺🇸" },
  { code: "GB", label: "United Kingdom", flag: "🇬🇧" },
  { code: "GH", label: "Ghana", flag: "🇬🇭" },
  { code: "KE", label: "Kenya", flag: "🇰🇪" },
  { code: "ZA", label: "South Africa", flag: "🇿🇦" },
  { code: "IN", label: "India", flag: "🇮🇳" },
  { code: "CA", label: "Canada", flag: "🇨🇦" },
  { code: "AU", label: "Australia", flag: "🇦🇺" },
  { code: "DE", label: "Germany", flag: "🇩🇪" },
];

function truncate(addr: string) {
  if (!addr) return "";
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

// ── Logo — exact Navbar pattern ───────────────────────────────────────────────
function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-8 w-8 shrink-0"
        style={{
          backgroundColor: "#facc15",
          WebkitMaskImage: "url('/quipay-icon-mark.png')",
          WebkitMaskSize: "contain",
          WebkitMaskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskImage: "url('/quipay-icon-mark.png')",
          maskSize: "contain",
          maskRepeat: "no-repeat",
          maskPosition: "center",
        }}
      />
      <span
        className="text-[22px] font-bold tracking-tight text-white leading-none select-none"
        style={{ letterSpacing: "-0.02em" }}
      >
        Quipay
      </span>
    </div>
  );
}

// ── Clean SVG icons ───────────────────────────────────────────────────────────
function IconStream() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

function IconVault() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <circle cx="12" cy="16" r="1" fill="currentColor" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

const FEATURES = [
  {
    Icon: IconStream,
    title: "Real-time payroll streams",
    desc: "Pay per second, not per month.",
  },
  {
    Icon: IconVault,
    title: "Non-custodial vault",
    desc: "On-chain funds, always your control.",
  },
  {
    Icon: IconGlobe,
    title: "Global workforce",
    desc: "Cross-border with zero FX fees.",
  },
];

export default function EmployerOnboarding() {
  const { address } = useWallet();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    businessName: "",
    registrationNumber: "",
    countryCode: "",
    contactName: "",
    contactEmail: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<OnboardResult | null>(null);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError(null);
  }

  function goToStep2(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.businessName.trim() ||
      !form.registrationNumber.trim() ||
      !form.countryCode
    ) {
      setError("Please fill in all required fields.");
      return;
    }
    setError(null);
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) {
      setError("Connect your wallet first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/employers/onboard`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": address.toLowerCase(),
          "x-user-role": "user",
        },
        credentials: "include",
        body: JSON.stringify({ ...form, evmAddress: address.toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Onboarding failed.");
      setResult(data as OnboardResult);
    } catch (err: unknown) {
      setError(
        (err instanceof Error ? err.message : null) ?? "Something went wrong.",
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Success ────────────────────────────────────────────────────────────────
  if (result) {
    const isVerified = result.status === "verified";
    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">
          <div className="flex justify-center mb-8">
            <div
              className={`w-[72px] h-[72px] rounded-full flex items-center justify-center
              ${
                isVerified
                  ? "bg-yellow-400/10 ring-1 ring-yellow-400/30 text-yellow-400"
                  : "bg-white/5 ring-1 ring-white/10 text-neutral-400"
              }`}
            >
              {isVerified ? (
                <IconCheck />
              ) : (
                <span className="text-2xl">⏳</span>
              )}
            </div>
          </div>
          <div className="text-center mb-9">
            <h2 className="text-white text-[1.9rem] font-bold tracking-tight mb-2">
              {isVerified ? "You're verified!" : "Application submitted"}
            </h2>
            <p className="text-neutral-500 text-[15px]">
              {isVerified
                ? "Your business is ready to run payroll streams."
                : "We're reviewing your details — usually under 24 hours."}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2.5 mb-5">
            {[
              { label: "Business", value: result.employer.business_name },
              { label: "Streams", value: String(result.chain.existingStreams) },
              {
                label: "Vault",
                value: `${result.chain.vaultBalance.toFixed(2)} USDC`,
              },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4 text-center"
              >
                <p className="text-neutral-600 text-xs mb-1">{s.label}</p>
                <p className="text-white text-sm font-semibold truncate">
                  {s.value}
                </p>
              </div>
            ))}
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-5 py-4 flex items-center gap-3 mb-6">
            <span className="h-2 w-2 rounded-full bg-emerald-400 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-neutral-600 text-xs mb-0.5">EVM address</p>
              <p className="text-white font-mono text-xs truncate">
                {result.chain.evmAddress}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              void navigate("/employer/dashboard");
            }}
            className="w-full bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold rounded-2xl py-[15px] transition-all duration-150 active:scale-[0.98]"
          >
            Go to Dashboard →
          </button>
        </div>
      </div>
    );
  }

  // ── Main layout ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex">
      {/* ── Left panel — people photo ──────────────────────────────── */}
      <div className="hidden lg:block lg:w-[50%] xl:w-[54%] relative overflow-hidden">
        <img
          src={HERO_IMG}
          alt="Team collaborating"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        {/* Layered dark treatment */}
        <div className="absolute inset-0 bg-black/60" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-black/50" />
        {/* Right-edge fade */}
        <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-r from-transparent to-black/70" />

        <div className="relative z-10 h-full flex flex-col justify-between p-12 xl:p-14">
          {/* Logo */}
          <Logo />

          {/* Hero copy */}
          <div>
            <p className="text-yellow-400 text-xs font-semibold uppercase tracking-[0.15em] mb-5">
              Business onboarding
            </p>
            <h1 className="text-white text-[2.8rem] xl:text-[3.2rem] font-bold leading-[1.06] tracking-tight mb-5">
              Pay your team
              <br />
              <span className="text-yellow-400">in real time.</span>
            </h1>
            <p className="text-white/50 text-[15px] leading-relaxed max-w-[300px] mb-10">
              Stream salaries second by second to anyone, anywhere. No delays,
              no FX friction.
            </p>

            {/* Features — clean text rows */}
            <div className="space-y-4">
              {FEATURES.map(({ Icon, title, desc }) => (
                <div key={title} className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-xl border border-white/[0.12] bg-white/[0.06] flex items-center justify-center text-white/70 flex-shrink-0">
                    <Icon />
                  </div>
                  <div>
                    <p className="text-white text-[13.5px] font-semibold leading-snug">
                      {title}
                    </p>
                    <p className="text-white/35 text-xs mt-[1px]">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-white/18 text-xs">
            © 2024 Quipay · Powered by Stellar
          </p>
        </div>
      </div>

      {/* ── Right panel — form ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 lg:px-12 xl:px-16 bg-[#080808]">
        <div className="w-full max-w-[400px]">
          {/* Mobile logo */}
          <div className="mb-9 lg:hidden">
            <Logo />
          </div>

          {/* Step track */}
          <div className="flex items-center gap-1.5 mb-6">
            <div
              className={`h-[2.5px] rounded-full transition-all duration-300 ${step >= 1 ? "w-9 bg-yellow-400" : "w-5 bg-white/10"}`}
            />
            <div
              className={`h-[2.5px] rounded-full transition-all duration-300 ${step >= 2 ? "w-9 bg-yellow-400" : "w-5 bg-white/10"}`}
            />
            <span className="text-neutral-600 text-[11px] font-medium uppercase tracking-widest ml-2">
              {step} / 2
            </span>
          </div>

          {/* Heading */}
          <div className="mb-6">
            <h2 className="text-white text-[1.65rem] font-bold tracking-tight leading-tight">
              {step === 1 ? "Business details" : "Contact info"}
            </h2>
            <p className="text-neutral-500 text-[13.5px] mt-1.5">
              {step === 1
                ? "Tell us about your organisation."
                : "Who should we reach for KYB updates?"}
            </p>
          </div>

          {/* Wallet strip */}
          <div className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6 border border-white/[0.07] bg-white/[0.025]">
            <span
              className={`h-[7px] w-[7px] rounded-full flex-shrink-0 ${address ? "bg-emerald-400" : "bg-neutral-700"}`}
            />
            <div className="min-w-0 flex-1">
              <p className="text-neutral-600 text-[10.5px] font-semibold uppercase tracking-wider">
                {address ? "Connected wallet" : "No wallet connected"}
              </p>
              {address && (
                <p className="text-white/70 font-mono text-[11.5px] mt-0.5">
                  {truncate(address)}
                </p>
              )}
            </div>
            {!address && (
              <span className="text-[11.5px] text-yellow-400 font-semibold">
                Connect →
              </span>
            )}
          </div>

          {/* ── Step 1 ── */}
          {step === 1 && (
            <form
              key="step1"
              onSubmit={goToStep2}
              className="space-y-3 animate-fade-in-up"
            >
              <Field label="Business name *">
                <input
                  name="businessName"
                  value={form.businessName}
                  onChange={handleChange}
                  required
                  minLength={2}
                  maxLength={200}
                  placeholder="Acme Corp"
                  className={inputCls}
                />
              </Field>

              <Field label="Registration number *">
                <input
                  name="registrationNumber"
                  value={form.registrationNumber}
                  onChange={handleChange}
                  required
                  minLength={3}
                  maxLength={100}
                  placeholder="RC-1234567"
                  className={inputCls}
                />
              </Field>

              <Field label="Country *">
                <div className="relative">
                  <select
                    name="countryCode"
                    value={form.countryCode}
                    onChange={handleChange}
                    required
                    className={`${inputCls} appearance-none pr-10`}
                  >
                    <option value="" disabled>
                      Select country
                    </option>
                    {COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.label}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none">
                    <IconChevron />
                  </span>
                </div>
              </Field>

              {error && <ErrorBanner msg={error} />}

              <button
                type="submit"
                className="w-full bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold rounded-xl py-[14px] mt-1 transition-all duration-150 active:scale-[0.98]"
              >
                Continue →
              </button>
            </form>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <form
              key="step2"
              onSubmit={(e) => {
                void handleSubmit(e);
              }}
              className="space-y-3 animate-fade-in-up"
            >
              <Field label="Contact name">
                <input
                  name="contactName"
                  value={form.contactName}
                  onChange={handleChange}
                  maxLength={120}
                  placeholder="John Doe"
                  className={inputCls}
                />
              </Field>

              <Field label="Contact email">
                <input
                  name="contactEmail"
                  value={form.contactEmail}
                  onChange={handleChange}
                  type="email"
                  maxLength={320}
                  placeholder="john@acme.com"
                  className={inputCls}
                />
              </Field>

              {error && <ErrorBanner msg={error} />}

              <div className="flex gap-2.5 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setError(null);
                  }}
                  className="flex-1 border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-white text-sm font-semibold rounded-xl py-[14px] transition-all duration-150 active:scale-[0.98]"
                >
                  ← Back
                </button>
                <button
                  type="submit"
                  disabled={loading || !address}
                  className="flex-[2] bg-yellow-400 hover:bg-yellow-300 text-black text-sm font-bold rounded-xl py-[14px] transition-all duration-150 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Submitting…
                    </span>
                  ) : (
                    "Submit for verification"
                  )}
                </button>
              </div>
            </form>
          )}

          <p className="text-neutral-700 text-[11.5px] mt-7">
            By submitting you agree to our{" "}
            <span className="text-neutral-500 underline underline-offset-2 cursor-pointer hover:text-white transition-colors">
              Terms of Service
            </span>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const inputCls =
  "w-full bg-white/[0.04] border border-white/[0.08] hover:border-white/[0.14] focus:border-yellow-400/40 focus:bg-white/[0.055] text-white rounded-xl px-4 py-[13px] text-[13.5px] placeholder-neutral-700 outline-none transition-all duration-150";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-neutral-500 text-[10.5px] font-semibold uppercase tracking-[0.1em]">
        {label}
      </label>
      {children}
    </div>
  );
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-red-950/20 border border-red-900/30 rounded-xl px-4 py-3">
      <svg
        className="text-red-400 flex-shrink-0 mt-[1px]"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <p className="text-red-400 text-[13px]">{msg}</p>
    </div>
  );
}
