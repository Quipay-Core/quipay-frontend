/**
 * networkStatus.ts — Stellar Horizon health monitoring.
 * Keeps the same NetworkStatus shape so NetworkStatusProvider compiles unchanged.
 */

import { HORIZON_URL, SOROBAN_RPC_URL } from "../contracts/util";

export interface RpcNodeHealth {
  name: string;
  url: string;
  status: "online" | "degraded" | "offline";
  latency: number;
  lastChecked: number;
}

export interface NetworkStatus {
  status: "online" | "degraded" | "offline";
  latency: number;
  congestion: "low" | "medium" | "high";
  minFee: number;
  horizonHealth: RpcNodeHealth;
  sorobanHealth: RpcNodeHealth;
  healthy?: boolean;
  latencyMs?: number;
  error?: string;
}

export async function getNetworkStatus(): Promise<NetworkStatus> {
  const start = Date.now();
  try {
    const res = await fetch(`${HORIZON_URL}/`);
    const latencyMs = Date.now() - start;
    const ok = res.ok;
    const horizonHealth: RpcNodeHealth = {
      name: "Stellar Horizon Testnet",
      url: HORIZON_URL,
      status: ok ? "online" : "degraded",
      latency: latencyMs,
      lastChecked: Date.now(),
    };
    const sorobanHealth: RpcNodeHealth = {
      name: "Soroban RPC Testnet",
      url: SOROBAN_RPC_URL,
      status: ok ? "online" : "degraded",
      latency: latencyMs,
      lastChecked: Date.now(),
    };
    return {
      status: ok ? "online" : "degraded",
      latency: latencyMs,
      congestion: "low",
      minFee: 100,
      horizonHealth,
      sorobanHealth,
      healthy: ok,
      latencyMs,
    };
  } catch (e) {
    const latencyMs = Date.now() - start;
    const offline: RpcNodeHealth = {
      name: "Stellar Horizon Testnet",
      url: HORIZON_URL,
      status: "offline",
      latency: latencyMs,
      lastChecked: Date.now(),
    };
    return {
      status: "offline",
      latency: latencyMs,
      congestion: "low",
      minFee: 100,
      horizonHealth: offline,
      sorobanHealth: {
        ...offline,
        name: "Soroban RPC Testnet",
        url: SOROBAN_RPC_URL,
      },
      healthy: false,
      error: e instanceof Error ? e.message : "Network unreachable",
      latencyMs,
    };
  }
}

export type HorizonStatus = RpcNodeHealth;
