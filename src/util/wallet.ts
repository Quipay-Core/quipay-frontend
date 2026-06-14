import {
  type ISupportedWallet,
  StellarWalletsKit,
  type WalletNetwork,
} from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import {
  networkPassphrase,
  HORIZON_URL,
  USDC_ISSUER,
  USDC_ASSET_CODE,
} from "../contracts/util";
import storage from "./storage";

const kit: StellarWalletsKit = new StellarWalletsKit({
  network: networkPassphrase as WalletNetwork,
  modules: [new FreighterModule(), new xBullModule()],
});

export const connectWallet = async () => {
  await kit.openModal({
    modalTitle: "Connect to your wallet",
    onWalletSelected: (option: ISupportedWallet) => {
      const selectedId = option.id;
      kit.setWallet(selectedId);

      void kit.getAddress().then((address) => {
        if (address.address) {
          storage.setItem("walletId", selectedId);
          storage.setItem("walletAddress", address.address);
        } else {
          storage.setItem("walletId", "");
          storage.setItem("walletAddress", "");
        }
      });

      if (selectedId === "freighter" || selectedId === "hot-wallet") {
        void kit.getNetwork().then((network) => {
          if (network.network && network.networkPassphrase) {
            storage.setItem("walletNetwork", network.network);
            storage.setItem("networkPassphrase", network.networkPassphrase);
          } else {
            storage.setItem("walletNetwork", "");
            storage.setItem("networkPassphrase", "");
          }
        });
      }
    },
  });
};

export const disconnectWallet = async () => {
  await kit.disconnect();
  storage.removeItem("walletId");
  storage.removeItem("walletAddress");
  storage.removeItem("walletNetwork");
  storage.removeItem("networkPassphrase");
};

// ─── Balances ─────────────────────────────────────────────────────────────────

export type MappedBalances = Record<
  string,
  { balance: string; assetCode: string }
>;

interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

export const fetchBalances = async (
  address: string,
): Promise<MappedBalances> => {
  if (!address || !address.startsWith("G")) return {};
  try {
    const res = await fetch(`${HORIZON_URL}/accounts/${address}`);
    if (!res.ok) return {};
    const data = (await res.json()) as { balances?: HorizonBalance[] };
    const result: MappedBalances = {};
    for (const b of data.balances ?? []) {
      if (b.asset_type === "native") {
        result["XLM"] = { balance: b.balance, assetCode: "XLM" };
      } else if (
        b.asset_code === USDC_ASSET_CODE &&
        b.asset_issuer === USDC_ISSUER
      ) {
        result["USDC"] = { balance: b.balance, assetCode: "USDC" };
      }
    }
    return result;
  } catch {
    return {};
  }
};

// ─── Transaction signing ──────────────────────────────────────────────────────

export const signTransaction = async (
  xdr: string,
  opts?: { networkPassphrase?: string },
): Promise<{ signedTxXdr: string }> => {
  const { signedTxXdr } = await kit.signTransaction(xdr, {
    networkPassphrase: opts?.networkPassphrase ?? networkPassphrase,
  });
  return { signedTxXdr };
};

export const wallet = kit;
