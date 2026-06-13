import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useWallet } from "../hooks/useWallet";

/**
 * Reads the request hostname and redirects to the appropriate route tree.
 *
 * employer.* → /employer/dashboard
 * employee.* → /employee/dashboard
 *
 * On plain hosts (localhost, *.vercel.app, the bare domain) this is a no-op —
 * path-based routing handles everything normally.
 *
 * Mount once near the root (inside BrowserRouter, outside route definitions).
 */
export default function SubdomainDetector() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { address } = useWallet();

  useEffect(() => {
    const host = window.location.hostname;

    // Only act on the root path so we don't interrupt deep-linked URLs
    if (pathname !== "/") return;

    if (host.startsWith("employer.")) {
      void navigate("/employer/dashboard", { replace: true });
    } else if (host.startsWith("employee.")) {
      void navigate("/employee/dashboard", { replace: true });
    }
    // else: path-based routing — do nothing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]); // re-run when wallet connects so the redirect fires after auth

  return null;
}
