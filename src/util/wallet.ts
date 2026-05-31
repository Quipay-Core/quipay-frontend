/**
 * wallet.ts — EVM wallet utilities for ARC.
 *
 * Replaces the Stellar/stellar-wallets-kit layer with viem + wagmi equivalents.
 *
 * MappedBalances keeps the same surface so WalletProvider and all consumers
 * compile without changes. The USDC balance replaces the old XLM/Stellar balance.
 */

import { createPublicClient, http, erc20Abi, type Address } from "viem";
import { arcTestnet, ARC_USDC_ADDRESS, formatUsdc } from "../contracts/util";

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Matches the old Horizon.HorizonApi.BalanceLine shape just enough
 * for existing consumers to work. Key is the asset code (e.g. "USDC").
 */
export type MappedBalances = Record<string, { balance: string; assetCode: string }>;

// ─── Balance fetching ─────────────────────────────────────────────────────────

/**
 * Fetch the USDC ERC-20 balance for an EVM address.
 * Returns MappedBalances with a "USDC" key for existing consumer compatibility.
 */
export async function fetchBalances(address: string): Promise<MappedBalances> {
  if (!address || !address.startsWith("0x")) return {};
  try {
    const client = createPublicClient({
      chain: arcTestnet,
      transport: http(),
    });
    const raw = await client.readContract({
      address: ARC_USDC_ADDRESS as Address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [address as Address],
    });
    const display = formatUsdc(raw as bigint);
    return { USDC: { balance: display, assetCode: "USDC" } };
  } catch {
    return {};
  }
}

// ─── Wallet connect / disconnect ──────────────────────────────────────────────
// Actual connect/disconnect is handled by ConnectKit + wagmi hooks in WalletProvider.
// These are no-ops kept for import compatibility.

export const connectWallet = async (): Promise<void> => {
  // ConnectKit's <ConnectKitButton /> handles this via the wagmi connector.
  console.warn("connectWallet(): use ConnectKitButton or wagmi useConnect instead");
};

export const disconnectWallet = async (): Promise<void> => {
  // Call wagmi's disconnect() from useDisconnect hook in components.
  console.warn("disconnectWallet(): use wagmi useDisconnect instead");
};

// ─── Stub kept for WalletProvider ────────────────────────────────────────────
// WalletProvider calls wallet.signTransaction. On EVM this is handled by
// wagmi's useWalletClient / writeContract. This stub prevents a crash.
export const wallet = {
  signTransaction: async (_xdr: string, _opts?: unknown): Promise<{ signedTxXdr: string }> =>  {
    throw new Error("signTransaction: use wagmi useWalletClient or writeContract instead");
  },
};
