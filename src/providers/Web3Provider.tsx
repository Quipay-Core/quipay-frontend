/**
 * Web3Provider — wraps wagmi's WagmiProvider + Reown AppKit (WalletConnect).
 * Must be an ancestor of WalletProvider and any wagmi hook consumers.
 * The AppKit modal is initialised as a side effect of importing ../lib/wagmi.
 */

import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "../lib/wagmi";

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>;
}
