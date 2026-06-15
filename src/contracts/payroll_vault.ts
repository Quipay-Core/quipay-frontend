/**
 * payroll_vault.ts
 * ─────────────────
 * Soroban read/write client for per-employer PayrollVault contracts.
 *
 * Each employer has their own vault deployed via the VaultFactory.
 * This module reads balances, liabilities, and builds deposit/withdraw txs.
 */

import {
  rpc,
  Contract,
  TransactionBuilder,
  Account,
  scValToNative,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import { SOROBAN_RPC_URL, networkPassphrase } from "./util";

// ─── Config ──────────────────────────────────────────────────────────────────

function getServer() {
  return new rpc.Server(SOROBAN_RPC_URL, { allowHttp: true });
}

const DUMMY_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

/**
 * Generic Soroban view call against a specific vault contract address.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function vaultView<T>(vaultAddress: string, method: string, args: any[] = []): Promise<T> {
  const server = getServer();
  const contract = new Contract(vaultAddress);
  const account = new Account(DUMMY_SOURCE, "0");
  const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(result)) {
    throw new Error(`Vault ${method}: ${result.error}`);
  }
  if (!result.result) throw new Error(`Vault ${method}: no result`);
  return scValToNative(result.result.retval) as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TokenVaultData {
  token: string;
  tokenSymbol: string;
  balance: bigint;
  liability: bigint;
  available: bigint;
}

export interface VaultInfo {
  address: string;
  balance: bigint;
  liability: bigint;
  available: bigint;
  isSolvent: boolean;
}

// ─── Read Functions ──────────────────────────────────────────────────────────

/**
 * Get the token balance held in a vault.
 */
export async function getVaultBalance(
  vaultAddress: string,
  tokenAddress: string,
): Promise<bigint> {
  try {
    const result = await vaultView<bigint>(vaultAddress, "get_balance", [
      nativeToScVal(tokenAddress, { type: "address" }),
    ]);
    return result;
  } catch {
    return 0n;
  }
}

/**
 * Get the total liability (committed to streams) in a vault.
 */
export async function getVaultLiability(
  vaultAddress: string,
  tokenAddress: string,
): Promise<bigint> {
  try {
    const result = await vaultView<bigint>(vaultAddress, "get_liability", [
      nativeToScVal(tokenAddress, { type: "address" }),
    ]);
    return result;
  } catch {
    return 0n;
  }
}

/**
 * Get available balance (balance - liability) in a vault.
 */
export async function getVaultAvailableBalance(
  vaultAddress: string,
  tokenAddress: string,
): Promise<bigint> {
  const balance = await getVaultBalance(vaultAddress, tokenAddress);
  const liability = await getVaultLiability(vaultAddress, tokenAddress);
  return balance > liability ? balance - liability : 0n;
}

/**
 * Get full vault data for a specific token.
 */
export async function getVaultData(
  vaultAddress: string,
  tokenAddress: string,
  tokenSymbol: string = "USDC",
): Promise<TokenVaultData> {
  const balance = await getVaultBalance(vaultAddress, tokenAddress);
  const liability = await getVaultLiability(vaultAddress, tokenAddress);
  const available = balance > liability ? balance - liability : 0n;

  return {
    token: tokenAddress,
    tokenSymbol,
    balance,
    liability,
    available,
  };
}

/**
 * Get vault info including solvency status.
 */
export async function getVaultInfo(
  vaultAddress: string,
  tokenAddress: string,
): Promise<VaultInfo> {
  const balance = await getVaultBalance(vaultAddress, tokenAddress);
  const liability = await getVaultLiability(vaultAddress, tokenAddress);
  const available = balance > liability ? balance - liability : 0n;

  return {
    address: vaultAddress,
    balance,
    liability,
    available,
    isSolvent: balance >= liability,
  };
}

/**
 * Get vault data for multiple tokens.
 * Pass the vault address and an array of token addresses.
 */
export async function getAllVaultData(
  vaultAddress: string,
  tokenAddresses: string[],
  tokenSymbols: string[] = [],
): Promise<TokenVaultData[]> {
  if (!vaultAddress) return [];

  const results: TokenVaultData[] = [];

  for (let i = 0; i < tokenAddresses.length; i++) {
    const token = tokenAddresses[i];
    const symbol = tokenSymbols[i] ?? "UNKNOWN";
    try {
      const data = await getVaultData(vaultAddress, token, symbol);
      results.push(data);
    } catch {
      // Skip tokens that fail
    }
  }

  return results;
}

// ─── Write Functions ─────────────────────────────────────────────────────────

/**
 * Build a transaction to deposit tokens into a vault.
 * The employer must sign and submit the returned XDR.
 */
export async function buildDepositTx(
  employerAddress: string,
  vaultAddress: string,
  tokenAddress: string,
  amount: bigint,
): Promise<{ preparedXdr: string }> {
  const server = getServer();
  const contract = new Contract(vaultAddress);
  const source = await server.getAccount(employerAddress);

  const tx = new TransactionBuilder(source, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "deposit",
        nativeToScVal(employerAddress, { type: "address" }),
        nativeToScVal(tokenAddress, { type: "address" }),
        nativeToScVal(amount, { type: "i128" }),
      ),
    )
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  const prepared = rpc.assembleTransaction(tx, simResult).build();

  return { preparedXdr: prepared.toXDR() };
}

/**
 * Build a transaction to withdraw tokens from a vault.
 * The employer must sign and submit the returned XDR.
 */
export async function buildVaultWithdrawTx(
  employerAddress: string,
  vaultAddress: string,
  tokenAddress: string,
  amount: bigint,
): Promise<{ preparedXdr: string }> {
  const server = getServer();
  const contract = new Contract(vaultAddress);
  const source = await server.getAccount(employerAddress);

  const tx = new TransactionBuilder(source, {
    fee: "100000",
    networkPassphrase,
  })
    .addOperation(
      contract.call(
        "withdraw",
        nativeToScVal(employerAddress, { type: "address" }),
        nativeToScVal(tokenAddress, { type: "address" }),
        nativeToScVal(amount, { type: "i128" }),
      ),
    )
    .setTimeout(30)
    .build();

  const simResult = await server.simulateTransaction(tx);
  const prepared = rpc.assembleTransaction(tx, simResult).build();

  return { preparedXdr: prepared.toXDR() };
}
