/**
 * OrgContext
 * ──────────
 * Provides organization context for multi-tenancy.
 * Tracks which org the user is currently managing.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useWallet } from "../hooks/useWallet";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgRecord {
  orgId: string;
  businessName: string;
  stellarAddress: string;
  role: "owner" | "admin" | "viewer";
  joinedAt: string;
}

interface OrgContextType {
  orgs: OrgRecord[];
  activeOrg: OrgRecord | null;
  setActiveOrg: (org: OrgRecord) => void;
  isLoading: boolean;
  refetch: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const OrgContext = createContext<OrgContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = "quipay-active-org";

export function OrgProvider({ children }: { children: ReactNode }) {
  const { address } = useWallet();
  const [orgs, setOrgs] = useState<OrgRecord[]>([]);
  const [activeOrg, setActiveOrgState] = useState<OrgRecord | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => setFetchTick((t) => t + 1), []);

  // Fetch orgs on mount and when address changes
  useEffect(() => {
    if (!address) {
      setOrgs([]);
      setActiveOrgState(null);
      return;
    }

    let cancelled = false;
    const fetchOrgs = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/orgs`, {
          headers: {
            "x-user-id": address,
            "x-user-role": "user",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch orgs (${res.status})`);
        }

        const data = (await res.json()) as { orgs: OrgRecord[] };
        if (cancelled) return;

        setOrgs(data.orgs ?? []);

        // Restore active org from localStorage
        const storedOrgId = localStorage.getItem(
          `${STORAGE_KEY_PREFIX}-${address}`,
        );
        const stored = data.orgs?.find((o) => o.orgId === storedOrgId);

        if (stored) {
          setActiveOrgState(stored);
        } else if (data.orgs?.length > 0) {
          // Default to first org
          setActiveOrgState(data.orgs[0]);
          localStorage.setItem(
            `${STORAGE_KEY_PREFIX}-${address}`,
            data.orgs[0].orgId,
          );
        }
      } catch {
        // Orgs endpoint might not exist yet — fail silently
        if (!cancelled) {
          setOrgs([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchOrgs();
    return () => {
      cancelled = true;
    };
  }, [address, fetchTick]);

  const setActiveOrg = useCallback(
    (org: OrgRecord) => {
      setActiveOrgState(org);
      if (address) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}-${address}`, org.orgId);
      }
    },
    [address],
  );

  return (
    <OrgContext.Provider
      value={{ orgs, activeOrg, setActiveOrg, isLoading, refetch }}
    >
      {children}
    </OrgContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOrg(): OrgContextType {
  const ctx = useContext(OrgContext);
  if (!ctx) {
    throw new Error("useOrg must be used within an OrgProvider");
  }
  return ctx;
}
