/**
 * vault_factory.ts
 * ─────────────────
 * Soroban read/write client for the VaultFactory contract.
 * Handles per-employer vault deployment and lookup.
 */

import {
  rpc,
  Contract,
  TransactionBuilder,
  Account,
  scValToNative,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import {
  SOROBAN_RPC_URL,
  networkPassphrase,
} from "./util";

// ─── Config ──────────────────────────────────────────────────────────────────

const VAULT_FACTORY_CONTRACT_ID =
  import.meta.env.VITE_VAULT_FACTORY_CONTRACT_ID ?? "";

function getServer() {
  return new rpc.Server(SOROBAN_RPC_URL, { allowHttp: true });
}

const DUMMY_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function factoryView<T>(method: string, args: any[] = []): Promise<T> {
  const server = getServer();
  const contract = new Contract(VAULT_FACTORY_CONTRACT_ID);
  const account = new Account(DUMMY_SOURCE, "0");
  const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (
    result === null ||
    typeof result === "string" ||
    !("retval" in result) ||
    result retval === undefined
  ) {
    throw new Error(`Simulation failed for ${method}`);
  }

  return scValToNative(result.retval) as T;
}

// ─── Read Functions ──────────────────────────────────────────────────────────

/**
 * Get the vault address for an employer.
 * Returns null if the employer doesn't have a vault yet.
 */
export async function getEmployerVault(
  employerAddress: string,
): Promise<string | null> {
  try {
    const result = await factoryView<string | null>("get_vault", [
      nativeToScVal(employerAddress, { type: "address" }),
    ]);
    return result ?? null;
  } catch {
    return null;
  }
}

/**
 * Check if an employer has a vault.
 */
export async function hasEmployerVault(
  employerAddress: string,
): Promise<boolean> {
  try {
    const result = await factoryView<boolean>("has_vault", [
      nativeToScVal(employerAddress, { type: "address" }),
    ]);
    return result;
  } catch {
    return false;
  }
}

/**
 * Get all deployed vault addresses.
 */
export async function getAllVaults(): Promise<string[]> {
  try {
    const result = await factoryView<string[]>("get_all_vaults", []);
    return result ?? [];
  } catch {
    return [];
  }
}

// ─── Write Functions ─────────────────────────────────────────────────────────

/**
 * Build a transaction to create a vault for the employer.
 * The employer must sign and submit the returned XDR.
 */
export async function buildCreateVaultTx(
  employerAddress: string,
): Promise<{ preparedXdr: string }> {
  const server = getServer();
  const contract = new Contract(VAULT_FACTORY_CONTRACT_ID);
  const source = await server.getAccount(employerAddress);

  const tx = new TransactionBuilder(source, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "create_vault",
        nativeToScVal(employerAddress, { type: "address" }),
      ),
    )
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  const prepared = rpc.assembleTransaction(tx, simResult).build();

  return { preparedXdr: prepared.toXDR() };
}
