import { useState, useEffect } from "react";
import { isWorkerRegistered } from "../contracts/workforce_registry";
import { getStreamsByEmployer } from "../contracts/payroll_stream";

/**
 * Role is determined entirely from on-chain state.
 * A wallet can hold BOTH roles simultaneously.
 *
 * employer = has created at least one stream via PayrollStream
 * worker   = registered in WorkforceRegistry
 *
 * Cached in localStorage (v3) for 5 minutes.
 * v3 shape: { roles: ActiveRole[], ts: number }
 * (v2 stored a single role string — key is different so old entries won't conflict)
 */

export type ActiveRole = "employer" | "worker";

const CACHE_TTL = 5 * 60 * 1000;
const cacheKey = (addr: string) => `quipay-role-v3-${addr}`;

function readCache(addr: string): ActiveRole[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(addr));
    if (!raw) return null;
    const { roles, ts } = JSON.parse(raw) as {
      roles: ActiveRole[];
      ts: number;
    };
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(cacheKey(addr));
      return null;
    }
    if (!Array.isArray(roles) || roles.length === 0) return null;
    return roles;
  } catch {
    return null;
  }
}

function writeCache(addr: string, roles: ActiveRole[]) {
  if (roles.length === 0) return;
  try {
    localStorage.setItem(
      cacheKey(addr),
      JSON.stringify({ roles, ts: Date.now() }),
    );
  } catch {
    /* storage unavailable */
  }
}

export function clearRoleCache(addr: string) {
  try {
    localStorage.removeItem(cacheKey(addr));
  } catch {
    /* */
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRoleDetect(address: string | undefined) {
  const [roles, setRoles] = useState<ActiveRole[]>([]);
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    if (!address) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRoles([]);
      return;
    }

    const cached = readCache(address);
    if (cached) {
      setRoles(cached);
      return;
    }

    setIsDetecting(true);

    void Promise.all([
      isWorkerRegistered(address, address).catch(() => false),
      getStreamsByEmployer(address, 0, 1).catch(() => ({
        streams: [],
        total: 0,
      })),
    ])
      .then(([isWorker, employerPage]) => {
        const page = employerPage as { total?: number; streams?: unknown[] };
        const hasStreams =
          (page?.total || 0) > 0 || (page?.streams?.length || 0) > 0;

        const detected: ActiveRole[] = [];
        if (isWorker) detected.push("worker");
        if (hasStreams) detected.push("employer");

        setRoles(detected);
        writeCache(address, detected);
      })
      .finally(() => {
        setIsDetecting(false);
      });
  }, [address]);

  // Add a role immediately (e.g. after user selects role during onboarding).
  const addRole = (role: ActiveRole) => {
    setRoles((prev) => {
      const next = prev.includes(role) ? prev : [...prev, role];
      if (address) writeCache(address, next);
      return next;
    });
  };

  const resetRoles = () => {
    if (address) clearRoleCache(address);
    setRoles([]);
    setIsDetecting(false);
  };

  return { roles, isDetecting, addRole, resetRoles };
}
