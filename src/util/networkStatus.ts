/**
 * networkStatus.ts — ARC network health monitoring.
 * Replaces the Stellar Horizon-based version.
 * Keeps the same NetworkStatus shape so NetworkStatusProvider compiles unchanged.
 */

import { createPublicClient, http } from "viem";
import { arcTestnet } from "../contracts/util";

/** Matches the original RpcNodeHealth shape used by NetworkStatusProvider. */
export interface RpcNodeHealth {
  name: string;
  url: string;
  status: "online" | "degraded" | "offline";
  latency: number;
  lastChecked: number;
}

/** Compatible with the original NetworkStatus shape in NetworkStatusProvider. */
export interface NetworkStatus {
  status: "online" | "degraded" | "offline";
  latency: number;
  congestion: "low" | "medium" | "high";
  minFee: number;
  horizonHealth: RpcNodeHealth;
  sorobanHealth: RpcNodeHealth;
  // ARC-specific extras
  healthy?: boolean;
  blockNumber?: bigint;
  latencyMs?: number;
  error?: string;
}

const defaultNodeHealth = (url: string): RpcNodeHealth => ({
  name: "ARC Testnet RPC",
  url,
  status: "online",
  latency: 0,
  lastChecked: Date.now(),
});

export async function getNetworkStatus(): Promise<NetworkStatus> {
  const rpcUrl = arcTestnet.rpcUrls.default.http[0];
  const start = Date.now();
  try {
    const client = createPublicClient({ chain: arcTestnet, transport: http() });
    const block = await client.getBlockNumber();
    const latencyMs = Date.now() - start;
    const nodeHealth: RpcNodeHealth = {
      name: "ARC Testnet RPC",
      url: rpcUrl,
      status: "online",
      latency: latencyMs,
      lastChecked: Date.now(),
    };
    return {
      status: "online",
      latency: latencyMs,
      congestion: "low",
      minFee: 0, // USDC gas on ARC is effectively free
      horizonHealth: nodeHealth,
      sorobanHealth: nodeHealth,
      healthy: true,
      blockNumber: block,
      latencyMs,
    };
  } catch (e) {
    const latencyMs = Date.now() - start;
    const offlineHealth: RpcNodeHealth = {
      ...defaultNodeHealth(rpcUrl),
      status: "offline",
      latency: latencyMs,
      lastChecked: Date.now(),
    };
    return {
      status: "offline",
      latency: latencyMs,
      congestion: "low",
      minFee: 0,
      horizonHealth: offlineHealth,
      sorobanHealth: offlineHealth,
      healthy: false,
      error: e instanceof Error ? e.message : "RPC unreachable",
      latencyMs,
    };
  }
}

// Backwards compat aliases used by NetworkHealthMonitor
export type HorizonStatus = RpcNodeHealth;
