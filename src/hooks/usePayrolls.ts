/**
 * usePayrolls
 * ───────────
 * Hook for payroll group CRUD and template management.
 */

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "./useWallet";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PayrollRecord {
  id: number;
  org_id: string;
  name: string;
  created_by: string;
  total_amount: string;
  stream_count: number;
  status: "draft" | "processing" | "active" | "completed" | "failed";
  created_at: string;
  completed_at: string | null;
  updated_at: string;
}

export interface PayrollEntryRecord {
  id: number;
  payroll_id: number;
  stream_id: number | null;
  worker_address: string;
  amount: string;
  status: "pending" | "active" | "failed";
  error_message: string | null;
  created_at: string;
}

export interface PayrollTemplateRecord {
  id: number;
  org_id: string;
  name: string;
  created_by: string;
  template_json: Array<{
    workerAddress: string;
    amount: string;
    purpose?: string;
  }>;
  created_at: string;
  updated_at: string;
}

interface CreatePayrollParams {
  orgId: string;
  name: string;
  entries: Array<{ workerAddress: string; amount: string }>;
}

interface CreateTemplateParams {
  orgId: string;
  name: string;
  entries: Array<{
    workerAddress: string;
    amount: string;
    purpose?: string;
  }>;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePayrolls(orgId: string | undefined) {
  const { address } = useWallet();
  const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => setFetchTick((t) => t + 1), []);

  useEffect(() => {
    if (!address || !orgId) return;

    let cancelled = false;
    const fetchPayrolls = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch(
          `${API_BASE}/payrolls?orgId=${encodeURIComponent(orgId)}`,
          {
            headers: {
              "x-user-id": address,
              "x-user-role": "user",
            },
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch payrolls (${res.status})`);
        }

        const data = (await res.json()) as { payrolls: PayrollRecord[] };
        if (!cancelled) {
          setPayrolls(data.payrolls ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load payrolls",
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPayrolls();
    return () => {
      cancelled = true;
    };
  }, [address, orgId, fetchTick]);

  // Create a payroll
  const createPayroll = useCallback(
    async (params: CreatePayrollParams) => {
      if (!address) return null;
      setError(null);

      try {
        const res = await fetch(`${API_BASE}/payrolls`, {
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
              `Failed to create payroll (${res.status})`,
          );
        }

        const data = (await res.json()) as { payroll: PayrollRecord };
        refetch();
        return data.payroll;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to create payroll",
        );
        return null;
      }
    },
    [address, refetch],
  );

  return {
    payrolls,
    isLoading,
    error,
    createPayroll,
    refetch,
  };
}

// ─── Standalone functions ─────────────────────────────────────────────────────

/**
 * Get a single payroll with entries.
 */
export async function getPayrollDetail(
  payrollId: number,
  userAddress: string,
): Promise<{
  payroll: PayrollRecord;
  entries: PayrollEntryRecord[];
} | null> {
  try {
    const res = await fetch(`${API_BASE}/payrolls/${payrollId}`, {
      headers: {
        "x-user-id": userAddress,
        "x-user-role": "user",
      },
    });

    if (!res.ok) return null;
    return (await res.json()) as {
      payroll: PayrollRecord;
      entries: PayrollEntryRecord[];
    };
  } catch {
    return null;
  }
}

// ─── Templates hook ───────────────────────────────────────────────────────────

export function usePayrollTemplates(orgId: string | undefined) {
  const { address } = useWallet();
  const [templates, setTemplates] = useState<PayrollTemplateRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchTick, setFetchTick] = useState(0);

  const refetch = useCallback(() => setFetchTick((t) => t + 1), []);

  useEffect(() => {
    if (!address || !orgId) return;

    let cancelled = false;
    const fetchTemplates = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/payrolls/templates?orgId=${encodeURIComponent(orgId)}`,
          {
            headers: {
              "x-user-id": address,
              "x-user-role": "user",
            },
          },
        );

        if (!res.ok) return;
        const data = (await res.json()) as {
          templates: PayrollTemplateRecord[];
        };
        if (!cancelled) {
          setTemplates(data.templates ?? []);
        }
      } catch {
        // Fail silently
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchTemplates();
    return () => {
      cancelled = true;
    };
  }, [address, orgId, fetchTick]);

  const saveTemplate = useCallback(
    async (params: CreateTemplateParams) => {
      if (!address) return false;
      try {
        const res = await fetch(`${API_BASE}/payrolls/templates`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": address,
            "x-user-role": "user",
          },
          body: JSON.stringify(params),
        });
        if (!res.ok) return false;
        refetch();
        return true;
      } catch {
        return false;
      }
    },
    [address, refetch],
  );

  const deleteTemplate = useCallback(
    async (templateId: number) => {
      if (!address || !orgId) return false;
      try {
        const res = await fetch(
          `${API_BASE}/payrolls/templates/${templateId}?orgId=${encodeURIComponent(orgId)}`,
          {
            method: "DELETE",
            headers: {
              "x-user-id": address,
              "x-user-role": "user",
            },
          },
        );
        if (!res.ok) return false;
        refetch();
        return true;
      } catch {
        return false;
      }
    },
    [address, orgId, refetch],
  );

  return {
    templates,
    isLoading,
    saveTemplate,
    deleteTemplate,
    refetch,
  };
}
