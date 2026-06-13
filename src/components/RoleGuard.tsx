import { Navigate, useLocation } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useRole } from "../context/RoleContext";
import type { ActiveRole } from "../hooks/useRoleDetect";

interface RoleGuardProps {
  requiredRole: ActiveRole;
  children: React.ReactNode;
}

/**
 * Guards a route tree to a specific role.
 * Must be used inside WalletGuard (assumes wallet is connected and role detected).
 * Shows loading while detecting, then redirects if the required role is missing.
 */
export default function RoleGuard({ requiredRole, children }: RoleGuardProps) {
  const { address } = useWallet();
  const { isDetecting, roles } = useRole();
  const location = useLocation();

  if (!address) return <Navigate to="/" replace />;

  if (isDetecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="w-8 h-8 border-2 rounded-full animate-spin border-white/10 border-t-yellow-400" />
      </div>
    );
  }

  if (!roles.includes(requiredRole)) {
    // Has the other role → redirect to that dashboard
    if (requiredRole === "employer" && roles.includes("worker")) {
      return <Navigate to="/employee/dashboard" replace />;
    }
    if (requiredRole === "worker" && roles.includes("employer")) {
      return <Navigate to="/employer/dashboard" replace />;
    }
    // No roles at all → role chooser
    return <Navigate to="/select-role" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
