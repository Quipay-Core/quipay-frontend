/**
 * useOrgMembers
 * ─────────────
 * Hook for managing org members (list, add, update role, remove).
 */

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "./useWallet";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgMemberRecord {
  id: number;
  org_id: string;
  user_id: string;
  role: "owner" | "admin" | "viewer";
  invited_by: string | null;
  joined_at: string;
  created_at: string;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOrgMembers(orgId: string | undefined) {
  const { address } = useWallet();
  const [members, setMembers] = useState<OrgMemberRecord[]>([]);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => setFetchTick((t) => t + 1), []);

  useEffect(() => {
    if (!address || !orgId) return;

    let cancelled = false;
    const fetchMembers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/orgs/${orgId}/members`, {
          headers: {
            "x-user-id": address,
            "x-user-role": "user",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch members (${res.status})`);
        }

        const data = (await res.json()) as {
          members: OrgMemberRecord[];
          role: string;
        };

        if (!cancelled) {
          setMembers(data.members ?? []);
          setMyRole(data.role ?? null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load members");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchMembers();
    return () => {
      cancelled = true;
    };
  }, [address, orgId, fetchTick]);

  // Add a member
  const addMember = useCallback(
    async (userId: string, role: "admin" | "viewer" = "viewer") => {
      if (!address || !orgId) return false;
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/orgs/${orgId}/members`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": address,
            "x-user-role": "user",
          },
          body: JSON.stringify({ userId, role }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Failed to add member (${res.status})`,
          );
        }

        refetch();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add member");
        return false;
      }
    },
    [address, orgId, refetch],
  );

  // Update a member's role
  const updateRole = useCallback(
    async (userId: string, role: string) => {
      if (!address || !orgId) return false;
      setError(null);

      try {
        const res = await fetch(
          `${API_BASE}/orgs/${orgId}/members/${userId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": address,
              "x-user-role": "user",
            },
            body: JSON.stringify({ role }),
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Failed to update role (${res.status})`,
          );
        }

        refetch();
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update role");
        return false;
      }
    },
    [address, orgId, refetch],
  );

  // Remove a member
  const removeMember = useCallback(
    async (userId: string) => {
      if (!address || !orgId) return false;
      setError(null);

      try {
        const res = await fetch(
          `${API_BASE}/orgs/${orgId}/members/${userId}`,
          {
            method: "DELETE",
            headers: {
              "x-user-id": address,
              "x-user-role": "user",
            },
          },
        );

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Failed to remove member (${res.status})`,
          );
        }

        refetch();
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to remove member",
        );
        return false;
      }
    },
    [address, orgId, refetch],
  );

  return {
    members,
    myRole,
    isLoading,
    error,
    addMember,
    updateRole,
    removeMember,
    refetch,
  };
}
