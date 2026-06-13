import { createContext } from "react";
import { signTransaction, type MappedBalances } from "../util/wallet";

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
