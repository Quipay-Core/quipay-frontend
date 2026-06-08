/**
 * wagmi config wired to ARC testnet via Reown AppKit (WalletConnect).
 */

import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import { createAppKit } from "@reown/appkit/react";
import { arcTestnet } from "../contracts/util";

// Get your own projectId at https://cloud.reown.com
const projectId =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) ?? "";

export const wagmiAdapter = new WagmiAdapter({
  networks: [arcTestnet],
  projectId,
  ssr: false,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

createAppKit({
  adapters: [wagmiAdapter],
  networks: [arcTestnet],
  projectId,
  metadata: {
    name: "Quipay",
    description: "Real-time payroll streaming on ARC",
    url:
      typeof window !== "undefined"
        ? window.location.origin
        : "https://quipay.app",
    icons: ["/favicon.ico"],
  },
  features: {
    analytics: false,
    email: false,
    socials: false,
    swaps: false,
    onramp: false,
  },
});
