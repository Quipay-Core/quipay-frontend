/**
 * useInvites
 * ──────────
 * Hook for managing the invite lifecycle (create, list, cancel, resend).
 * Talks to the backend /invites API.
 */

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "./useWallet";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InviteRecord {
  id: number;
  token: string;
  link: string;
  code: string;
  email: string | null;
  workerAddress: string | null;
  purpose: string | null;
  amount: string | null;
  tokenAsset: string;
  status: "pending" | "accepted" | "declined" | "expired";
  expiresAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  createdAt: string;
}

export interface InviteDetails {
  token: string;
  employerName: string;
  employerAddress: string;
  purpose: string | null;
  amount: string | null;
  tokenAsset: string;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface CreateInviteParams {
  email?: string;
  workerAddress?: string;
  purpose?: string;
  amount?: string;
  tokenAsset?: string;
  expiresInDays?: number;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useInvites() {
  const { address } = useWallet();
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => setFetchTick((t) => t + 1), []);

  // Fetch invites for the current employer
  useEffect(() => {
    if (!address) return;

    let cancelled = false;
    const fetchInvites = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/invites`, {
          headers: {
            "x-user-id": address,
            "x-user-role": "user",
          },
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch invites (${res.status})`);
        }

        const data = (await res.json()) as {
          invites: InviteRecord[];
          pendingCount: number;
        };

        if (!cancelled) {
          setInvites(data.invites ?? []);
          setPendingCount(data.pendingCount ?? 0);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load invites");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchInvites();
    return () => {
      cancelled = true;
    };
  }, [address, fetchTick]);

  // Create a new invite
  const createInvite = useCallback(
    async (params: CreateInviteParams): Promise<InviteRecord | null> => {
      if (!address) return null;

      setError(null);

      try {
        const res = await fetch(`${API_BASE}/invites`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": address,
            "x-user-role": "user",
          },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ??
              `Failed to create invite (${res.status})`,
          );
        }

        const data = (await res.json()) as InviteRecord;
        refetch();
        return data;
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to create invite";
        setError(msg);
        return null;
      }
    },
    [address, refetch],
  );

  // Cancel an invite
  const cancelInvite = useCallback(
    async (inviteId: number): Promise<boolean> => {
      if (!address) return false;

      setError(null);

      try {
        const res = await fetch(`${API_BASE}/invites/${inviteId}`, {
          method: "DELETE",
          headers: {
            "x-user-id": address,
            "x-user-role": "user",
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ??
              `Failed to cancel invite (${res.status})`,
          );
        }

        refetch();
        return true;
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to cancel invite";
        setError(msg);
        return false;
      }
    },
    [address, refetch],
  );

  // Resend an invite email
  const resendInvite = useCallback(
    async (inviteId: number): Promise<boolean> => {
      if (!address) return false;

      setError(null);

      try {
        const res = await fetch(`${API_BASE}/invites/${inviteId}/resend`, {
          method: "POST",
          headers: {
            "x-user-id": address,
            "x-user-role": "user",
          },
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ??
              `Failed to resend invite (${res.status})`,
          );
        }

        return true;
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Failed to resend invite";
        setError(msg);
        return false;
      }
    },
    [address],
  );

  return {
    invites,
    pendingCount,
    isLoading,
    error,
    createInvite,
    cancelInvite,
    resendInvite,
    refetch,
  };
}

// ─── Standalone lookup (for public invite pages, no auth needed) ──────────────

/**
 * Fetch invite details by token (public, no auth).
 * Used on the /join/:token page before wallet connection.
 */
export async function getInviteByToken(
  token: string,
): Promise<InviteDetails | null> {
  try {
    const res = await fetch(`${API_BASE}/invites/${token}`);
    if (!res.ok) return null;
    return (await res.json()) as InviteDetails;
  } catch {
    return null;
  }
}

/**
 * Accept an invite (public, called after wallet connection).
 */
export async function acceptInvite(
  token: string,
  workerAddress: string,
  fullName?: string,
  jobTitle?: string,
): Promise<{ success: boolean; employerAddress?: string; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/invites/${token}/accept`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workerAddress, fullName, jobTitle }),
    });

    const body = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: (body as { error?: string }).error ?? "Failed to accept invite",
      };
    }

    return body as { success: boolean; employerAddress?: string };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

/**
 * Decline an invite (public).
 */
export async function declineInvite(
  token: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/invites/${token}/decline`, {
      method: "POST",
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        success: false,
        error: (body as { error?: string }).error ?? "Failed to decline invite",
      };
    }

    return { success: true };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}
