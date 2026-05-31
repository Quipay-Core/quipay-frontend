/**
 * wagmi + ConnectKit configuration for ARC testnet.
 *
 * ConnectKit provides the wallet connection modal (MetaMask, WalletConnect, Coinbase).
 * wagmi provides React hooks for reading/writing contracts and wallet state.
 *
 * USDC is ARC's native gas token — the chain definition reflects this.
 */

import { createConfig, http } from "wagmi";
import { getDefaultConfig } from "connectkit";
import { arcTestnet } from "../contracts/util";

const walletConnectProjectId =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? "";

export const wagmiConfig = createConfig(
  getDefaultConfig({
    chains: [arcTestnet],
    transports: {
      [arcTestnet.id]: http("https://rpc.testnet.arc.network"),
    },
    walletConnectProjectId,
    appName: "Quipay",
    appDescription: "Real-time payroll streaming on ARC",
    appUrl: typeof window !== "undefined" ? window.location.origin : "https://quipay.app",
  }),
);
