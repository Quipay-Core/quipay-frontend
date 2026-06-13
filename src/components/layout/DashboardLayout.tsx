import { useState, useEffect } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useWallet } from "../../hooks/useWallet";
import { useRole } from "../../context/RoleContext";
import { Suspense } from "react";
import NotificationCenter from "../NotificationCenter";

// ─── Nav configs ───────────────────────────────────────────────────────────────

const EMPLOYEE_NAV = [
  {
    label: "My Earnings",
    to: "/employee/dashboard",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Withdraw",
    to: "/employee/withdraw",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
    ),
  },
  {
    label: "Transactions",
    to: "/employee/transactions",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: "Settings",
    to: "/employee/settings",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
] as const;

const EMPLOYER_MAIN_NAV = [
  {
    label: "Overview",
    to: "/employer/dashboard",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Payroll",
    to: "/employer/payroll",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path
          d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    label: "Create Stream",
    to: "/employer/create-stream",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v8M8 12h8" strokeLinecap="round" />
      </svg>
    ),
    accent: true,
  },
  {
    label: "Treasury",
    to: "/employer/treasury",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    label: "Workforce",
    to: "/employer/workforce",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path
          d="M4 20h16M4 20v-4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M8 12V8m8 4V8M12 12V4"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
] as const;

const EMPLOYER_ANALYTICS_NAV = [
  {
    label: "Analytics",
    to: "/employer/analytics",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M3 3v18h18" strokeLinecap="round" />
        <path
          d="M18 17l-5-5-3 3-4-4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    label: "Reports",
    to: "/employer/reports",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Treasury Analytics",
    to: "/employer/treasury-analytics",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <rect x="2" y="3" width="20" height="14" rx="2" />
        <path d="M8 21h8M12 17v4" strokeLinecap="round" />
      </svg>
    ),
  },
] as const;

const EMPLOYER_TOOLS_NAV = [
  {
    label: "Governance",
    to: "/employer/governance",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <path d="M9 22V12h6v10" />
      </svg>
    ),
  },
  {
    label: "Address Book",
    to: "/employer/address-book",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <path d="M22 10H2M12 4v16" />
      </svg>
    ),
  },
  {
    label: "Templates",
    to: "/employer/templates",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    label: "Withdraw",
    to: "/employer/withdraw",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
        <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    to: "/employer/settings",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        className="w-5 h-5 shrink-0"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
] as const;

// ─── Loading fallback ──────────────────────────────────────────────────────────

function DashboardLoadingFallback() {
  return (
    <div className="flex items-center justify-center flex-1">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 rounded-full animate-spin border-white/10 border-t-yellow-400" />
        <p className="text-[12px] font-medium text-neutral-600">Loading...</p>
      </div>
    </div>
  );
}

// ─── Nav section ──────────────────────────────────────────────────────────────

function NavSection({
  label,
  items,
  collapsed,
}: {
  label?: string;
  items: readonly {
    label: string;
    to: string;
    icon: React.ReactNode;
    accent?: boolean;
  }[];
  collapsed: boolean;
}) {
  return (
    <div className="mb-1">
      {label && !collapsed && (
        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.1em] text-neutral-600">
          {label}
        </p>
      )}
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to.endsWith("/dashboard")}
          className={({ isActive }) =>
            `relative flex items-center gap-3 rounded-lg px-3 py-3 text-[15px] font-medium transition-all duration-150 mb-0.5 ${
              isActive
                ? "bg-yellow-400/10 text-white"
                : item.accent
                  ? "text-yellow-400 hover:bg-yellow-400/8"
                  : "text-neutral-500 hover:bg-white/[0.05] hover:text-neutral-200"
            } ${collapsed ? "justify-center px-2" : ""}`
          }
          title={collapsed ? item.label : undefined}
        >
          {({ isActive }) => (
            <>
              <span className={isActive ? "text-yellow-400" : ""}>
                {item.icon}
              </span>
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <span
                  className="ml-auto h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: "#facc15" }}
                />
              )}
              {isActive && collapsed && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r-full"
                  style={{ backgroundColor: "#facc15" }}
                />
              )}
            </>
          )}
        </NavLink>
      ))}
    </div>
  );
}

// ─── Role switcher ─────────────────────────────────────────────────────────────

function RoleSwitcher({
  view,
  collapsed,
}: {
  view: "employer" | "employee";
  collapsed: boolean;
}) {
  const navigate = useNavigate();
  const { setActiveView } = useRole();

  function switchTo(next: "employer" | "employee") {
    setActiveView(next);
    void navigate(
      next === "employer" ? "/employer/dashboard" : "/employee/dashboard",
    );
  }

  if (collapsed) {
    const next = view === "employer" ? "employee" : "employer";
    return (
      <button
        onClick={() => switchTo(next)}
        title={`Switch to ${next} view`}
        className="flex w-full justify-center rounded-lg p-2 text-neutral-600 hover:bg-white/[0.05] hover:text-neutral-300 transition-colors mb-1"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="w-4 h-4"
        >
          <path
            d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"
            strokeLinecap="round"
          />
        </svg>
      </button>
    );
  }

  return (
    <div className="mx-2 mb-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 flex">
      <button
        onClick={() => switchTo("employer")}
        className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all ${
          view === "employer"
            ? "bg-yellow-400/10 text-yellow-400"
            : "text-neutral-600 hover:text-neutral-400"
        }`}
      >
        Employer
      </button>
      <button
        onClick={() => switchTo("employee")}
        className={`flex-1 rounded-lg px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide transition-all ${
          view === "employee"
            ? "bg-blue-500/10 text-blue-400"
            : "text-neutral-600 hover:text-neutral-400"
        }`}
      >
        Employee
      </button>
    </div>
  );
}

// ─── Sidebar content ──────────────────────────────────────────────────────────

function SidebarContent({
  collapsed,
  address,
  shortAddr,
  view,
  hasBothRoles,
  setCollapsed,
  onDisconnect,
}: {
  collapsed: boolean;
  address: string | undefined;
  shortAddr: string;
  view: "employer" | "employee";
  hasBothRoles: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  onDisconnect: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-[#050505]">
      {/* Logo */}
      <div
        className={`flex items-center border-b border-white/[0.05] ${collapsed ? "justify-center px-0 py-[14px]" : "gap-2.5 px-4 py-[14px]"}`}
      >
        <div
          className="w-8 h-8 shrink-0"
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
        {!collapsed && (
          <span
            className="text-[17px] font-bold tracking-tight text-white"
            style={{ letterSpacing: "-0.02em" }}
          >
            Quipay
          </span>
        )}
      </div>

      {/* Nav */}
      <div className="flex-1 px-2 py-3 overflow-y-auto scrollbar-none">
        {view === "employee" ? (
          <NavSection items={EMPLOYEE_NAV} collapsed={collapsed} />
        ) : (
          <>
            <NavSection items={EMPLOYER_MAIN_NAV} collapsed={collapsed} />
            <div className="my-2 border-t border-white/[0.05]" />
            <NavSection
              label="Analytics"
              items={EMPLOYER_ANALYTICS_NAV}
              collapsed={collapsed}
            />
            <div className="my-2 border-t border-white/[0.05]" />
            <NavSection
              label="Tools"
              items={EMPLOYER_TOOLS_NAV}
              collapsed={collapsed}
            />
          </>
        )}
      </div>

      {/* Role switcher — only shown when wallet has both roles */}
      {hasBothRoles && (
        <>
          <div className="mx-2 mb-1 border-t border-white/[0.05]" />
          <RoleSwitcher view={view} collapsed={collapsed} />
        </>
      )}

      {/* Role badge */}
      {!collapsed && !hasBothRoles && (
        <div className="px-4 pb-1">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
              view === "employee"
                ? "bg-blue-500/10 text-blue-400"
                : "bg-yellow-400/10 text-yellow-400"
            }`}
          >
            {view === "employee" ? "Employee" : "Employer"}
          </span>
        </div>
      )}

      {/* Bottom: collapse toggle + user */}
      <div className="border-t border-white/[0.05] p-2">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className={`hidden md:flex mb-2 w-full items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-medium text-neutral-600 hover:bg-white/[0.04] hover:text-neutral-400 transition-colors ${collapsed ? "justify-center" : ""}`}
        >
          <svg
            className={`h-3.5 w-3.5 transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M15 18l-6-6 6-6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {!collapsed && <span>Collapse</span>}
        </button>

        {address ? (
          <div
            className={`flex items-center gap-2.5 rounded-lg px-2 py-2 ${collapsed ? "justify-center" : ""}`}
          >
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-black text-black"
              style={{ backgroundColor: "#facc15" }}
            >
              {address.slice(1, 3).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate font-mono text-[13px] font-medium text-white">
                  {shortAddr}
                </p>
                <button
                  onClick={onDisconnect}
                  className="text-[12px] text-neutral-600 hover:text-red-400 transition-colors"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Dashboard Layout ──────────────────────────────────────────────────────────

export default function DashboardLayout({
  view,
}: {
  view: "employer" | "employee";
}) {
  const navigate = useNavigate();
  const { address, disconnect } = useWallet();
  const { roles, resetRoles } = useRole();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const hasBothRoles = roles.includes("employer") && roles.includes("worker");

  useEffect(() => {
    const fn = () => {
      if (window.innerWidth >= 768) setMobileOpen(false);
    };
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const shortAddr = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : "";
  const sidebarWidth = collapsed ? 56 : 220;

  const handleDisconnect = () => {
    resetRoles();
    void disconnect().then(() => navigate("/"));
  };

  const newStreamPath = "/employer/create-stream";

  return (
    <div className="flex h-screen overflow-hidden text-white bg-black">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex flex-col shrink-0 border-r border-white/[0.06] transition-all duration-200 overflow-hidden"
        style={{ width: sidebarWidth }}
      >
        <SidebarContent
          collapsed={collapsed}
          address={address}
          shortAddr={shortAddr}
          view={view}
          hasBothRoles={hasBothRoles}
          setCollapsed={setCollapsed}
          onDisconnect={handleDisconnect}
        />
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-white/[0.06] transition-transform duration-250 md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <SidebarContent
          collapsed={false}
          address={address}
          shortAddr={shortAddr}
          view={view}
          hasBothRoles={hasBothRoles}
          setCollapsed={setCollapsed}
          onDisconnect={handleDisconnect}
        />
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] bg-black/90 px-4 sm:px-6 backdrop-blur-md">
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="flex h-8 w-8 md:hidden items-center justify-center rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <svg
              className="w-4 h-4 text-neutral-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
            </svg>
          </button>

          <div className="hidden md:block" />

          <div className="flex items-center gap-2 ml-auto">
            <NotificationCenter />
            {view === "employer" && (
              <button
                className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[12px] font-bold text-black transition-all hover:opacity-90 active:scale-[0.97]"
                style={{ backgroundColor: "#facc15" }}
                onClick={() => void navigate(newStreamPath)}
              >
                <svg
                  className="w-3 h-3"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
                New Stream
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-black">
          <Suspense fallback={<DashboardLoadingFallback />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
