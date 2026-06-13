/**
 * WalletProvider — Stellar wallet state via @creit.tech/stellar-wallets-kit v2.
 * Uses event-based listeners (StellarWalletsKit.on) instead of polling.
 * https://developers.stellar.org/docs/tools/developer-tools/wallets
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import {
  kit,
  fetchBalances,
  signTransaction,
  KitEventType,
} from "../util/wallet";
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

  // Event-based address tracking — no polling needed.
  useEffect(() => {
    // Restore previously connected address on mount.
    void kit
      .getAddress()
      .then(({ address: addr }) => setAddress(addr || undefined))
      .catch(() => {});

    // STATE_UPDATED fires when user connects or switches accounts.
    const unsubUpdate = kit.on(KitEventType.STATE_UPDATED, (event) => {
      setAddress(event.payload.address || undefined);
    });

    // DISCONNECT fires when user disconnects.
    const unsubDisconnect = kit.on(KitEventType.DISCONNECT, () => {
      setAddress(undefined);
      setBalances({});
    });

    return () => {
      unsubUpdate();
      unsubDisconnect();
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
      switchAccount: () => {},
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
