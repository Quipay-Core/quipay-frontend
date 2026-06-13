import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useRole } from "../context/RoleContext";
import type { ActiveView } from "../context/RoleContext";
import type { ActiveRole } from "../hooks/useRoleDetect";
import { useWallet } from "../hooks/useWallet";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

export default function SelectRole() {
  const navigate = useNavigate();
  const { roles, addRole, setActiveView } = useRole();
  const [loading, setLoading] = useState(false);
  const { address: walletAddress } = useWallet();

  async function choose(picked: ActiveRole) {
    setLoading(true);
    addRole(picked);
    const view: ActiveView = picked === "employer" ? "employer" : "employee";
    setActiveView(view);

    if (picked === "employer") {
      try {
        const address = walletAddress ?? "";
        const res = await fetch(`${API_BASE}/api/employers/status`, {
          credentials: "include",
          headers: {
            "x-user-id": address.toLowerCase(),
            "x-user-role": "user",
          },
        });
        const data = (await res.json()) as { status?: string };
        if (data.status === "not_started") {
          void navigate("/onboard", { replace: true });
          return;
        }
      } catch {
        // fall through to dashboard
      }
      void navigate("/employer/dashboard", { replace: true });
    } else {
      void navigate("/employee/dashboard", { replace: true });
    }
  }

  // If user already has both roles, show a switcher instead of a full chooser
  const hasBoth = roles.includes("employer") && roles.includes("worker");

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/[0.1] bg-[#111] shadow-2xl overflow-hidden">
        <div className="h-[3px]" style={{ background: "#facc15" }} />
        <div className="p-8">
          {/* Logo */}
          <div className="mb-6 flex items-center justify-center gap-2.5">
            <div
              className="h-8 w-8 rounded-xl"
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
              className="text-[20px] font-bold text-white"
              style={{ letterSpacing: "-0.02em" }}
            >
              Quipay
            </span>
          </div>

          <h2 className="mb-2 text-center text-[22px] font-black text-white tracking-tight">
            {hasBoth ? "Continue as…" : "Welcome to Quipay"}
          </h2>
          <p className="mb-8 text-center text-[14px] text-neutral-500">
            {hasBoth
              ? "Choose which dashboard to open."
              : "How will you use this account?"}
          </p>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => void choose("employer")}
              disabled={loading}
              className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-left transition-all hover:border-yellow-400/30 hover:bg-yellow-400/[0.04] disabled:opacity-50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 group-hover:bg-yellow-400/20 transition-colors">
                <svg
                  className="h-6 w-6 text-yellow-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                >
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <line x1="12" y1="12" x2="12" y2="16" />
                  <line x1="10" y1="14" x2="14" y2="14" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-white">
                  I'm an Employer
                </p>
                <p className="text-[13px] text-neutral-500 mt-0.5">
                  Create streams and manage my payroll vault
                </p>
              </div>
              <svg
                className="h-5 w-5 shrink-0 text-neutral-700 group-hover:text-yellow-400 transition-colors"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            <button
              onClick={() => void choose("worker")}
              disabled={loading}
              className="group flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 text-left transition-all hover:border-yellow-400/30 hover:bg-yellow-400/[0.04] disabled:opacity-50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-yellow-400/10 group-hover:bg-yellow-400/20 transition-colors">
                <svg
                  className="h-6 w-6 text-yellow-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                >
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-bold text-white">
                  I'm an Employee
                </p>
                <p className="text-[13px] text-neutral-500 mt-0.5">
                  Register with my employer and track my earnings
                </p>
              </div>
              <svg
                className="h-5 w-5 shrink-0 text-neutral-700 group-hover:text-yellow-400 transition-colors"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>

          {!hasBoth && (
            <p className="mt-5 text-center text-[11px] text-neutral-700">
              A single wallet can hold both roles. You can set up the other
              profile later.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
