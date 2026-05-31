/**
 * payroll_stream.ts
 * ──────────────────
 * viem read/write client for the PayrollStream contract on ARC.
 *
 * All amounts are in USDC with 6 decimal places.
 * 5.00 USDC = 5_000_000n  (NOT 1e7 stroops — that was Stellar)
 *
 * Contract address is read from VITE_PAYROLL_STREAM_CONTRACT_ID.
 */

import { createPublicClient, http, type Address } from "viem";
import { PAYROLL_STREAM_ABI } from "./abi/PayrollStream.abi";
import { arcTestnet, USDC_DECIMALS } from "./util";

// ─── Contract address ─────────────────────────────────────────────────────────

export const PAYROLL_STREAM_ADDRESS: Address = (
  import.meta.env.VITE_PAYROLL_STREAM_CONTRACT_ID as string | undefined
)?.trim() as Address ?? "0x0000000000000000000000000000000000000000";

// ─── Types ────────────────────────────────────────────────────────────────────

/** Stream status enum — mirrors PayrollStream.Status in Solidity. */
export enum StreamStatus {
  Active = 0,
  PendingCancel = 1,
  Cancelled = 2,
  Completed = 3,
  Paused = 4,
  Disputed = 5,
}

/** On-chain Stream struct returned by getStream(). */
export interface ContractStream {
  employer: Address;
  worker: Address;
  token: Address;
  ratePerSecond: bigint;   // USDC 6-decimal units per second
  rate?: bigint;           // alias for ratePerSecond
  startTs: bigint;
  start_ts?: bigint;
  endTs: bigint;
  end_ts?: bigint;
  cliffTs: bigint;
  cliff_ts?: bigint;
  totalAmount: bigint;     // 6-decimal USDC
  total_amount?: bigint;
  withdrawnAmount: bigint; // 6-decimal USDC
  withdrawn_amount?: bigint;
  pausedAt: bigint;
  totalPausedDuration: bigint;
  cancelRequestedAt: bigint;
  createdAt: bigint;
  closedAt: bigint;
  metadataHash: `0x${string}`;
  status: number;          // StreamStatus enum value
}

/** Parameters for createStream / batchCreate. */
export interface StreamParams {
  worker: Address;
  token: Address;
  ratePerSecond: bigint;
  startTs: bigint;
  endTs: bigint;
  cliffTs: bigint;
  metadataHash: `0x${string}`;
}

// ─── Public client (read-only) ────────────────────────────────────────────────

function getClient() {
  return createPublicClient({
    chain: arcTestnet,
    transport: http(),
  });
}

// ─── Read functions ───────────────────────────────────────────────────────────

/** Fetch a single stream by ID. */
export async function getStreamById(_callerOrId: string | bigint, streamId?: bigint): Promise<ContractStream> {
  const client = getClient();
  const id = streamId ?? (_callerOrId as bigint);
  const result = await client.readContract({
    address: PAYROLL_STREAM_ADDRESS,
    abi: PAYROLL_STREAM_ABI,
    functionName: "getStream",
    args: [id],
  });
  return result as ContractStream;
}

/** Return all stream IDs for an employer address. */
export async function getStreamsByEmployer(employer: string | Address, _offset?: number, _limit?: number): Promise<{ streams: ContractStream[] }> {
  const client = getClient();
  const ids = await client.readContract({
    address: PAYROLL_STREAM_ADDRESS,
    abi: PAYROLL_STREAM_ABI,
    functionName: "getStreamsByEmployer",
    args: [employer as Address],
  }) as bigint[];
  // Fetch each stream in parallel
  const streams = await Promise.all(ids.map(id => getStreamById(id)));
  return { streams };
}

/** Return all stream IDs for a worker address. */
export async function getStreamsByWorker(worker: string | Address, _limit?: number): Promise<bigint[]> {
  const client = getClient();
  const result = await client.readContract({
    address: PAYROLL_STREAM_ADDRESS,
    abi: PAYROLL_STREAM_ABI,
    functionName: "getStreamsByWorker",
    args: [worker],
  });
  return result as bigint[];
}

/**
 * Returns how much USDC is currently withdrawable for a stream.
 * Value is in 6-decimal USDC units.
 */
export async function getWithdrawable(streamId: bigint): Promise<bigint> {
  const client = getClient();
  return client.readContract({
    address: PAYROLL_STREAM_ADDRESS,
    abi: PAYROLL_STREAM_ABI,
    functionName: "withdrawable",
    args: [streamId],
  }) as Promise<bigint>;
}

/**
 * Aggregate worker balance across all active streams.
 * Returns { totalWithdrawable, totalWithdrawn, totalStreaming } in 6-decimal USDC.
 */
export async function getWorkerBalance(worker: Address): Promise<{
  totalWithdrawable: bigint;
  totalWithdrawn: bigint;
  totalStreaming: bigint;
}> {
  const client = getClient();
  const result = await client.readContract({
    address: PAYROLL_STREAM_ADDRESS,
    abi: PAYROLL_STREAM_ABI,
    functionName: "workerBalance",
    args: [worker],
  }) as [bigint, bigint, bigint];
  return {
    totalWithdrawable: result[0],
    totalWithdrawn: result[1],
    totalStreaming: result[2],
  };
}

// ─── Decimal helpers ──────────────────────────────────────────────────────────

/** Convert a 6-decimal USDC bigint to a float (for display only). */
export function usdcToFloat(amount: bigint): number {
  return Number(amount) / 10 ** USDC_DECIMALS;
}

/** Convert a float to a 6-decimal USDC bigint. */
export function floatToUsdc(amount: number): bigint {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

// ─── Type alias for backwards compat with existing hooks ─────────────────────
// hooks that import `ContractStream` from here get the correct EVM shape.
export type { ContractStream as ContractStreamType };

// ─── Backwards-compat stubs for reportService ────────────────────────────────

/** Receipt from a closed stream. Mirrors the on-chain Receipt struct. */
export interface ContractPaymentReceipt {
  receiptId: bigint;
  receipt_id: bigint;
  streamId: bigint;
  stream_id: bigint;
  employer: Address;
  worker: Address;
  token: Address;
  totalPaid: bigint;
  total_paid: bigint;
  createdAt: bigint;
  finalizedAt: bigint;
  finalized_at: bigint;
  cancelled: boolean;
  status: "completed" | "cancelled";
}

/** Return the ERC-20 symbol for a token address. Falls back to shortened address. */
export async function getTokenSymbol(_callerOrToken: string, tokenAddress?: Address): Promise<string> {
  const addr = (tokenAddress ?? _callerOrToken) as string;
  if (!addr) return 'UNKNOWN';
  if (addr.toLowerCase() === '0x3600000000000000000000000000000000000000') return 'USDC';
  try {
    const { createPublicClient, http } = await import('viem');
    const { arcTestnet } = await import('./util');
    const client = createPublicClient({ chain: arcTestnet, transport: http() });
    const symbol = await client.readContract({
      address: addr as `0x${string}`,
      abi: [{ type: 'function', name: 'symbol', inputs: [], outputs: [{ name: '', type: 'string' }], stateMutability: 'view' }] as const,
      functionName: 'symbol',
    });
    return symbol as string;
  } catch {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
}

// ─── submitAndAwaitTx stub ────────────────────────────────────────────────────
// Original: submitted a signed Soroban XDR and waited for confirmation.
// On ARC: use wagmi's writeContract / waitForTransactionReceipt instead.
export async function submitAndAwaitTx(_signedXdr: string, _opts?: unknown): Promise<string> {
  throw new Error('submitAndAwaitTx: use wagmi writeContract + waitForTransactionReceipt on ARC');
}

export async function buildWithdrawTx(
  _streamIdOrWorker: bigint | string,
  _workerOrStreamId?: string | bigint,
): Promise<{ preparedXdr: string }> {
  // On ARC: use wagmi writeContract({ functionName: 'withdraw', args: [streamId] })
  // This stub keeps the UI flow working without throwing at build time.
  return { preparedXdr: '' };
}

export async function buildCancelStreamTx(
  _employerOrStreamId: string | bigint,
  _streamId?: bigint | string,
): Promise<{ preparedXdr: string }> {
  return { preparedXdr: '' };
}

export async function buildPauseStreamTx(
  _employerOrStreamId: string | bigint,
  _streamId?: bigint | string,
): Promise<{ preparedXdr: string }> {
  return { preparedXdr: '' };
}

export async function buildResumeStreamTx(
  _employerOrStreamId: string | bigint,
  _streamId?: bigint | string,
): Promise<{ preparedXdr: string }> {
  return { preparedXdr: '' };
}

export interface BatchStreamEntry {
  worker: string;
  token: string;
  ratePerSecond?: bigint;
  rate?: bigint;
  startTs: number;
  endTs: number;
  cliffTs?: number;
  metadataHash?: string;
}

export async function buildBatchCreateStreamsTx(
  _employer: string,
  _entries: BatchStreamEntry[],
): Promise<{ preparedXdr: string }> {
  return { preparedXdr: '' };
}

// Backwards compat alias
export { PAYROLL_STREAM_ADDRESS as PAYROLL_STREAM_CONTRACT_ID };

export interface WithdrawalEvent {
  streamId: string;
  amount: number;
  timestamp: number;
  txHash: string;
  token: string;
  ledgerClosedAt: string;
}

export async function getWorkerWithdrawalEvents(
  _worker: string,
  _limit = 50,
): Promise<WithdrawalEvent[]> {
  return [];
}
