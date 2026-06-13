/**
 * WalletProvider — Stellar wallet state via @creit.tech/stellar-wallets-kit.
 *
 * Keeps the same WalletContext shape so all existing consumers compile unchanged.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { kit, fetchBalances, signTransaction } from "../util/wallet";
import type { MappedBalances } from "../util/wallet";
import { networkPassphrase } from "../contracts/util";

export interface WalletContextType {
  address?: string;
  balances: MappedBalances;
  isPending: boolean;
  network?: string;
  networkPassphrase?: string;
  signTransaction: typeof signTransaction;
  updateBalances: () => Promise<void>;
  connectionError?: string;
  clearError: () => void;
  disconnect: () => Promise<void>;
  accounts: string[];
  switchAccount: (address: string) => void;
}

export const WalletContext = createContext<WalletContextType>({
  isPending: true,
  balances: {},
  updateBalances: async () => {},
  signTransaction,
  clearError: () => {},
  disconnect: async () => {},
  accounts: [],
  switchAccount: () => {},
});

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | undefined>();
  const [balances, setBalances] = useState<MappedBalances>({});
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();

  const clearError = useCallback(() => setConnectionError(undefined), []);

  const updateBalances = useCallback(async () => {
    if (!address) {
      setBalances({});
      return;
    }
    try {
      setBalances(await fetchBalances(address));
    } catch {
      setBalances({});
    }
  }, [address]);

  useEffect(() => {
    startTransition(() => {
      void updateBalances();
    });
  }, [updateBalances]);

  // Listen for wallet kit address changes (e.g. user switches account in Freighter)
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const { address: addr } = await kit.getAddress();
        if (!cancelled) setAddress(addr || undefined);
      } catch {
        // Wallet not connected yet — that's fine
      }
    };
    void poll();
    const id = setInterval(() => {
      void poll();
    }, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await kit.disconnect();
    } catch (e) {
      setConnectionError(e instanceof Error ? e.message : "Disconnect failed");
    }
    setAddress(undefined);
    setBalances({});
  }, []);

  const contextValue = useMemo<WalletContextType>(
    () => ({
      address,
      network: "Stellar Testnet",
      networkPassphrase,
      balances,
      updateBalances,
      isPending,
      signTransaction,
      connectionError,
      clearError,
      disconnect,
      accounts: address ? [address] : [],
      switchAccount: () => {}, // handled by wallet extension itself
    }),
    [
      address,
      balances,
      updateBalances,
      isPending,
      connectionError,
      clearError,
      disconnect,
    ],
  );

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}
