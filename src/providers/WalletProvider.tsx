/**
 * WalletProvider — EVM wallet state via wagmi + ConnectKit.
 *
 * Keeps the same WalletContext shape so all existing consumers
 * (WalletButton, DashboardLayout, WalletGuard, etc.) compile unchanged.
 *
 * Replaced:  StellarWalletsKit + Horizon balance polling
 * With:      wagmi useAccount + useDisconnect + USDC ERC-20 balance
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, useDisconnect } from "wagmi";
import { fetchBalances } from "../util/wallet";
import type { MappedBalances } from "../util/wallet";
import { wallet } from "../util/wallet";

const signTransaction = wallet.signTransaction.bind(wallet);

export interface WalletContextType {
  address?: string;
  balances: MappedBalances;
  isPending: boolean;
  network?: string;
  networkPassphrase?: string;
  signTransaction: typeof wallet.signTransaction;
  updateBalances: () => Promise<void>;
  connectionError?: string;
  clearError: () => void;
  disconnect: () => Promise<void>;
  accounts: string[];
  switchAccount: (address: string) => void;
}

export const WalletContext =
  createContext<WalletContextType>({
    isPending: true,
    balances: {},
    updateBalances: async () => {},
    signTransaction,
    clearError: () => {},
    disconnect: async () => {},
    accounts: [],
    switchAccount: () => {},
  });

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const queryClient = useQueryClient();
  const { address: evmAddress, chain } = useAccount();
  const { disconnectAsync } = useDisconnect();

  const [balances, setBalances] = useState<MappedBalances>({});
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const clearError = useCallback(() => setConnectionError(undefined), []);

  const updateBalances = useCallback(async () => {
    if (!evmAddress) { setBalances({}); return; }
    try {
      const b = await fetchBalances(evmAddress);
      setBalances(b);
    } catch {
      setBalances({});
    }
  }, [evmAddress]);

  useEffect(() => {
    startTransition(() => { void updateBalances(); });
  }, [updateBalances]);

  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Disconnect failed";
      setConnectionError(msg);
    }
    queryClient.clear();
    setBalances({});
  }, [disconnectAsync, queryClient]);

  const switchAccount = useCallback((_address: string) => {
    // Multi-account switching is handled by the wallet extension itself on EVM.
    // This is a no-op stub for interface compatibility.
  }, []);

  const contextValue = useMemo(
    () => ({
      address: evmAddress,
      network: chain?.name,
      networkPassphrase: String(chain?.id ?? ""),
      balances,
      updateBalances,
      isPending,
      signTransaction,
      connectionError,
      clearError,
      disconnect,
      accounts: evmAddress ? [evmAddress] : [],
      switchAccount,
    }),
    [
      evmAddress,
      chain,
      balances,
      updateBalances,
      isPending,
      connectionError,
      clearError,
      disconnect,
      switchAccount,
    ],
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
};
