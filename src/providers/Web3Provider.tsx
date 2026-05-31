/**
 * Web3Provider — wraps wagmi's WagmiProvider + ConnectKitProvider.
 * Must be an ancestor of WalletProvider and any wagmi hook consumers.
 */

import { WagmiProvider } from "wagmi";
import { ConnectKitProvider } from "connectkit";
import { wagmiConfig } from "../lib/wagmi";

export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <ConnectKitProvider
        theme="midnight"
        options={{
          hideBalance: false,
          initialChainId: 5042002,
        }}
      >
        {children}
      </ConnectKitProvider>
    </WagmiProvider>
  );
}
