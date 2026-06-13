import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import storage from "../util/storage";
import {
  wallet,
  fetchBalances,
  signTransaction,
  type MappedBalances,
} from "../util/wallet";
import { networkPassphrase as defaultPassphrase } from "../contracts/util";
import { WalletContext, type WalletContextType } from "./WalletContext";

export { WalletContext, type WalletContextType };

interface WalletBehavior {
  getAddressBehavior: "standard" | "popup-always";
  supportsGetNetwork: boolean;
}

const DEFAULT_WALLET_BEHAVIOR: WalletBehavior = {
  getAddressBehavior: "popup-always",
  supportsGetNetwork: false,
};

const WALLET_BEHAVIORS: Record<string, WalletBehavior> = {
  freighter: { getAddressBehavior: "standard", supportsGetNetwork: true },
  "hot-wallet": {
    getAddressBehavior: "popup-always",
    supportsGetNetwork: true,
  },
  hana: { getAddressBehavior: "standard", supportsGetNetwork: false },
  lobstr: { getAddressBehavior: "popup-always", supportsGetNetwork: false },
  albedo: { getAddressBehavior: "popup-always", supportsGetNetwork: false },
  xbull: { getAddressBehavior: "standard", supportsGetNetwork: false },
  rabet: { getAddressBehavior: "standard", supportsGetNetwork: false },
  klever: { getAddressBehavior: "popup-always", supportsGetNetwork: true },
};

function getWalletBehavior(walletId: string): WalletBehavior {
  return WALLET_BEHAVIORS[walletId] ?? DEFAULT_WALLET_BEHAVIOR;
}

const POLL_INTERVAL = 1000;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | undefined>();
  const [balances, setBalances] = useState<MappedBalances>({});
  const [network, setNetwork] = useState<string | undefined>();
  const [netPassphrase, setNetPassphrase] = useState<string | undefined>();
  const [connectionError, setConnectionError] = useState<string | undefined>();
  const [isPending, startTransition] = useTransition();
  const popupLock = useRef(false);

  const clearError = useCallback(() => setConnectionError(undefined), []);

  const nullify = useCallback(() => {
    setAddress(undefined);
    setNetwork(undefined);
    setNetPassphrase(undefined);
    setBalances({});
    storage.setItem("walletId", "");
    storage.setItem("walletAddress", "");
    storage.setItem("walletNetwork", "");
    storage.setItem("networkPassphrase", "");
  }, []);

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
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!address) {
      setBalances({});
      return;
    }
    fetchBalances(address)
      .then((b) => {
        if (!cancelled) setBalances(b);
      })
      .catch(() => {
        if (!cancelled) setBalances({});
      });
    return () => {
      cancelled = true;
    };
  }, [address]);

  const fetchAddress = useCallback(
    async (
      walletId: string,
      cachedAddress: string | null,
    ): Promise<{ address: string }> => {
      const behavior = getWalletBehavior(walletId);
      if (behavior.getAddressBehavior === "popup-always" && cachedAddress) {
        return { address: cachedAddress };
      }
      return wallet.getAddress();
    },
    [],
  );

  const fetchNetwork = useCallback(
    async (
      walletId: string,
      cachedNetwork: string | null,
      cachedPassphrase: string | null,
    ): Promise<{ network: string; networkPassphrase: string }> => {
      const behavior = getWalletBehavior(walletId);
      if (!behavior.supportsGetNetwork) {
        return {
          network: cachedNetwork ?? "testnet",
          networkPassphrase: cachedPassphrase ?? defaultPassphrase,
        };
      }
      return wallet.getNetwork();
    },
    [],
  );

  const updateCurrentWalletState = useCallback(async () => {
    const storedWalletId = storage.getItem("walletId");
    const walletNetwork = storage.getItem("walletNetwork");
    const walletAddr = storage.getItem("walletAddress");
    const passphrase = storage.getItem("networkPassphrase");

    if (!address && walletAddr && walletNetwork && passphrase) {
      setAddress(walletAddr);
      setNetwork(walletNetwork);
      setNetPassphrase(passphrase);
    }

    if (!storedWalletId) {
      nullify();
      return;
    }

    if (popupLock.current) return;

    try {
      popupLock.current = true;
      wallet.setWallet(storedWalletId);

      const [addressResult, networkResult] = await Promise.all([
        fetchAddress(storedWalletId, walletAddr),
        fetchNetwork(storedWalletId, walletNetwork, passphrase),
      ]);

      if (!addressResult.address) {
        storage.setItem("walletId", "");
        return;
      }

      storage.setItem("walletAddress", addressResult.address);
      storage.setItem("walletNetwork", networkResult.network);
      storage.setItem("networkPassphrase", networkResult.networkPassphrase);
      setAddress(addressResult.address);
      setNetwork(networkResult.network);
      setNetPassphrase(networkResult.networkPassphrase);
    } catch (e) {
      nullify();
      setConnectionError(e instanceof Error ? e.message : "Wallet error");
    } finally {
      popupLock.current = false;
    }
  }, [address, nullify, fetchAddress, fetchNetwork]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let isMounted = true;

    const poll = async () => {
      if (!isMounted) return;
      await updateCurrentWalletState();
      if (isMounted) timer = setTimeout(() => void poll(), POLL_INTERVAL);
    };

    startTransition(async () => {
      await updateCurrentWalletState();
      if (isMounted) timer = setTimeout(() => void poll(), POLL_INTERVAL);
    });

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const disconnect = useCallback(async () => {
    try {
      await wallet.disconnect();
    } catch {
      /* ignore */
    }
    nullify();
  }, [nullify]);

  const contextValue = useMemo<WalletContextType>(
    () => ({
      address,
      network,
      networkPassphrase: netPassphrase,
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
      network,
      netPassphrase,
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
