/**
 * payroll_vault.ts — NOT YET IMPLEMENTED FOR ARC
 *
 * The Soroban PayrollVault contract has no ARC/EVM counterpart yet.
 * The vault pattern (pooled USDC float) may be merged into PayrollStream v2
 * or deployed as a separate contract.
 *
 * All exports return empty/zero values so existing consumers compile.
 */

export const PAYROLL_VAULT_CONTRACT_ID: string = "";

export interface TokenVaultData {
  token: string;
  tokenSymbol: string;
  balance: bigint;
  liability: bigint;
  available: bigint;
}

export async function getVaultBalance(_token: string): Promise<bigint> {
  return 0n;
}

export async function getVaultLiability(_token: string): Promise<bigint> {
  return 0n;
}

export async function getVaultAvailableBalance(_token: string): Promise<bigint> {
  return 0n;
}

export async function getVaultData(_token: string): Promise<TokenVaultData> {
  return { token: _token, tokenSymbol: "USDC", balance: 0n, liability: 0n, available: 0n };
}

export async function getAllVaultData(_hints?: unknown[], _caller?: string): Promise<TokenVaultData[]> {
  return [];
}

export async function buildDepositTx(
  _employer: string,
  _token: string,
  _amount: bigint,
): Promise<{ preparedXdr: string }> {
  return { preparedXdr: '' };
}

export async function buildVaultWithdrawTx(
  _employer: string,
  _caller: string,
  _token: string,
  _amount: bigint,
): Promise<{ preparedXdr: string }> {
  return { preparedXdr: '' };
}
