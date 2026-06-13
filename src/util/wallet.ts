import { StellarWalletsKit, Networks } from "@creit.tech/stellar-wallets-kit";
import { FreighterModule } from "@creit.tech/stellar-wallets-kit/modules/freighter";
import { xBullModule } from "@creit.tech/stellar-wallets-kit/modules/xbull";
import {
  HORIZON_URL,
  networkPassphrase,
  USDC_ISSUER,
  USDC_ASSET_CODE,
} from "../contracts/util";

export type MappedBalances = Record<
  string,
  { balance: string; assetCode: string }
>;

StellarWalletsKit.init({
  modules: [new FreighterModule(), new xBullModule()],
  network: Networks.TESTNET,
});

// All methods on StellarWalletsKit v2 are static — export the class itself.
export const kit = StellarWalletsKit;

interface HorizonBalance {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
  balance: string;
}

export async function fetchBalances(address: string): Promise<MappedBalances> {
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
}

export async function signTransaction(
  xdr: string,
  opts?: { networkPassphrase?: string },
): Promise<{ signedTxXdr: string }> {
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr, {
    networkPassphrase: opts?.networkPassphrase ?? networkPassphrase,
  });
  return { signedTxXdr };
}

export const wallet = { signTransaction };
