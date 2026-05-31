/**
 * NetworkHealthMonitor — ARC version.
 * Shows ARC testnet RPC health status.
 */
import { useContext } from "react";
import { NetworkStatusContext } from "../providers/NetworkStatusProvider";

export default function NetworkHealthMonitor() {
  const ctx = useContext(NetworkStatusContext);
  if (!ctx) return null;
  const { status, latency } = ctx;
  const colour = status === "online" ? "#4ade80" : status === "degraded" ? "#fb923c" : "#f87171";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: colour, display: "inline-block" }} />
      <span style={{ color: "#aaa" }}>ARC Testnet · {status} · {latency}ms</span>
    </div>
  );
}
