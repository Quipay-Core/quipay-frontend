import { Navigate, useLocation } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";
import { useRole } from "../context/RoleContext";

interface WalletGuardProps {
  children: React.ReactNode;
}

export default function WalletGuard({ children }: WalletGuardProps) {
  const { address } = useWallet();
  const { isDetecting, roles } = useRole();
  const location = useLocation();

  if (!address) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (isDetecting) {
    return (
      <div className="flex h-screen items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin border-white/10 border-t-yellow-400" />
          <p className="text-[12px] font-medium text-neutral-600">
            Checking your profile…
          </p>
        </div>
      </div>
    );
  }

  if (roles.length === 0) {
    return <Navigate to="/select-role" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
