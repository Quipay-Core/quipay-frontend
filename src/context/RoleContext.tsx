/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useMemo } from "react";
import type { ActiveRole } from "../hooks/useRoleDetect";
import { useRoleDetect } from "../hooks/useRoleDetect";
import { useWallet } from "../hooks/useWallet";

export type ActiveView = "employer" | "employee";

const VIEW_KEY = "quipay-active-view-v1";

function readViewPref(): ActiveView | null {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "employer" || v === "employee" ? v : null;
  } catch {
    return null;
  }
}

function writeViewPref(view: ActiveView) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* */
  }
}

interface RoleContextType {
  roles: ActiveRole[];
  isDetecting: boolean;
  activeView: ActiveView | null;
  setActiveView: (view: ActiveView) => void;
  addRole: (role: ActiveRole) => void;
  resetRoles: () => void;
  hasRole: (role: ActiveRole) => boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const { address } = useWallet();
  const { roles, isDetecting, addRole, resetRoles } = useRoleDetect(address);
  const [activeView, setActiveViewState] = useState<ActiveView | null>(
    readViewPref,
  );

  // When roles resolve, auto-set activeView if not already set
  useEffect(() => {
    if (isDetecting || activeView) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (roles.includes("employer")) setActiveViewState("employer");
    else if (roles.includes("worker")) setActiveViewState("employee");
  }, [roles, isDetecting, activeView]);

  const setActiveView = (view: ActiveView) => {
    setActiveViewState(view);
    writeViewPref(view);
  };

  const value = useMemo<RoleContextType>(
    () => ({
      roles,
      isDetecting,
      activeView,
      setActiveView,
      addRole,
      resetRoles,
      hasRole: (role: ActiveRole) => roles.includes(role),
    }),

    [roles, isDetecting, activeView, addRole, resetRoles],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
