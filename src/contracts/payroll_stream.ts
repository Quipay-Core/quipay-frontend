/**
 * payroll_stream.ts
 * ──────────────────
 * Soroban read/write client for the PayrollStream contract on Stellar testnet.
 * All monetary amounts are in stroops (7 decimal places): 1 USDC = 10_000_000.
 */

import {
  rpc,
  Contract,
  TransactionBuilder,
  Account,
  scValToNative,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";
import {
  SOROBAN_RPC_URL,
  PAYROLL_STREAM_CONTRACT_ID,
  networkPassphrase,
  USDC_ASSET_CODE,
  USDC_DECIMALS,
} from "./util";

// ─── RPC server ───────────────────────────────────────────────────────────────

function getServer() {
  return new rpc.Server(SOROBAN_RPC_URL, { allowHttp: true });
}

// Dummy source used for read-only simulations (sequence 0 is fine for simulate).
const DUMMY_SOURCE = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function sorobanView<T>(method: string, args: any[] = []): Promise<T> {
  const server = getServer();
  const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);
  const account = new Account(DUMMY_SOURCE, "0");
  const tx = new TransactionBuilder(account, { fee: "100", networkPassphrase })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();
  const result = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(result)) {
    throw new Error(`Soroban ${method}: ${result.error}`);
  }
  if (!result.result) throw new Error(`Soroban ${method}: no result`);
  return scValToNative(result.result.retval) as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export enum StreamStatus {
  Active = 0,
  PendingCancel = 1,
  Cancelled = 2,
  Completed = 3,
  Paused = 4,
  Disputed = 5,
}

/** On-chain stream struct. All monetary values in stroops (7 decimals). */
export interface ContractStream {
  employer: string;
  worker: string;
  token: string;
  ratePerSecond: bigint;
  rate?: bigint;
  startTs: bigint;
  start_ts?: bigint;
  endTs: bigint;
  end_ts?: bigint;
  cliffTs: bigint;
  cliff_ts?: bigint;
  totalAmount: bigint;
  total_amount?: bigint;
  withdrawnAmount: bigint;
  withdrawn_amount?: bigint;
  pausedAt: bigint;
  totalPausedDuration: bigint;
  cancelRequestedAt: bigint;
  createdAt: bigint;
  closedAt: bigint;
  metadataHash: string;
  status: number;
}

export interface StreamParams {
  worker: string;
  token: string;
  ratePerSecond: bigint;
  startTs: bigint;
  endTs: bigint;
  cliffTs: bigint;
  metadataHash: string;
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

export interface ContractPaymentReceipt {
  receiptId: bigint;
  receipt_id: bigint;
  streamId: bigint;
  stream_id: bigint;
  employer: string;
  worker: string;
  token: string;
  totalPaid: bigint;
  total_paid: bigint;
  createdAt: bigint;
  finalizedAt: bigint;
  finalized_at: bigint;
  cancelled: boolean;
  status: "completed" | "cancelled";
}

export interface WithdrawalEvent {
  streamId: string;
  amount: number;
  timestamp: number;
  txHash: string;
  token: string;
  ledgerClosedAt: string;
}

// ─── Contract address ─────────────────────────────────────────────────────────

export const PAYROLL_STREAM_ADDRESS = PAYROLL_STREAM_CONTRACT_ID;

// ─── ScVal helpers ────────────────────────────────────────────────────────────

function toAddress(addr: string) {
  return new Address(addr).toScVal();
}

function toU64(n: bigint) {
  return nativeToScVal(n, { type: "u64" });
}

// ─── Normalise raw Soroban struct → ContractStream ───────────────────────────

function normalizeStream(raw: Record<string, unknown>): ContractStream {
  const toBigInt = (v: unknown): bigint => {
    if (typeof v === "bigint") return v;
    if (typeof v === "number") return BigInt(Math.round(v));
    if (typeof v === "string") return BigInt(v);
    return 0n;
  };
  const employer = String(raw.employer ?? "");
  const worker = String(raw.worker ?? "");
  const token = String(raw.token ?? "");
  const ratePerSecond = toBigInt(
    raw.rate ?? raw.rate_per_second ?? raw.ratePerSecond ?? 0,
  );
  const startTs = toBigInt(raw.start_ts ?? raw.startTs ?? 0);
  const endTs = toBigInt(raw.end_ts ?? raw.endTs ?? 0);
  const cliffTs = toBigInt(raw.cliff_ts ?? raw.cliffTs ?? 0);
  const totalAmount = toBigInt(raw.total_amount ?? raw.totalAmount ?? 0);
  const withdrawnAmount = toBigInt(
    raw.withdrawn_amount ?? raw.withdrawnAmount ?? 0,
  );
  const status = Number(raw.status ?? 0);
  return {
    employer,
    worker,
    token,
    ratePerSecond,
    rate: ratePerSecond,
    startTs,
    start_ts: startTs,
    endTs,
    end_ts: endTs,
    cliffTs,
    cliff_ts: cliffTs,
    totalAmount,
    total_amount: totalAmount,
    withdrawnAmount,
    withdrawn_amount: withdrawnAmount,
    pausedAt: toBigInt(raw.paused_at ?? raw.pausedAt ?? 0),
    totalPausedDuration: toBigInt(
      raw.total_paused_duration ?? raw.totalPausedDuration ?? 0,
    ),
    cancelRequestedAt: toBigInt(
      raw.cancel_requested_at ?? raw.cancelRequestedAt ?? 0,
    ),
    createdAt: toBigInt(raw.created_at ?? raw.createdAt ?? 0),
    closedAt: toBigInt(raw.closed_at ?? raw.closedAt ?? 0),
    metadataHash: String(raw.metadata_hash ?? raw.metadataHash ?? ""),
    status,
  };
}

// ─── Read functions ───────────────────────────────────────────────────────────

export async function getStreamById(
  _callerOrId: string | bigint,
  streamId?: bigint,
): Promise<ContractStream> {
  const id = streamId !== undefined ? streamId : (_callerOrId as bigint);
  const raw = await sorobanView<Record<string, unknown>>("get_stream", [
    toU64(id),
  ]);
  return normalizeStream(raw);
}

export async function getStreamsByEmployer(
  employer: string,
  _offset?: number,
  _limit?: number,
): Promise<{ streams: ContractStream[] }> {
  const ids = await sorobanView<bigint[]>("streams_by_employer", [
    toAddress(employer),
  ]);
  const streams = await Promise.all(ids.map((id) => getStreamById(id)));
  return { streams };
}

export async function getStreamsByWorker(
  worker: string,
  _limit?: number,
): Promise<bigint[]> {
  return sorobanView<bigint[]>("streams_by_worker", [toAddress(worker)]);
}

export async function getWithdrawable(streamId: bigint): Promise<bigint> {
  return sorobanView<bigint>("withdrawable", [toU64(streamId)]);
}

export async function getWorkerBalance(worker: string): Promise<{
  totalWithdrawable: bigint;
  totalWithdrawn: bigint;
  totalStreaming: bigint;
}> {
  const raw = await sorobanView<
    [bigint, bigint, bigint] | Record<string, bigint>
  >("worker_balance", [toAddress(worker)]);
  if (Array.isArray(raw)) {
    return {
      totalWithdrawable: raw[0],
      totalWithdrawn: raw[1],
      totalStreaming: raw[2],
    };
  }
  return {
    totalWithdrawable: BigInt(
      (raw as Record<string, bigint>).withdrawable ?? 0n,
    ),
    totalWithdrawn: BigInt((raw as Record<string, bigint>).withdrawn ?? 0n),
    totalStreaming: BigInt((raw as Record<string, bigint>).streaming ?? 0n),
  };
}

export async function getTokenSymbol(
  _callerOrToken: string,
  _tokenAddress?: string,
): Promise<string> {
  return USDC_ASSET_CODE;
}

export async function getWorkerWithdrawalEvents(
  _worker: string,
  _limit = 50,
): Promise<WithdrawalEvent[]> {
  return [];
}

// ─── Tx builders ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function buildSorobanTx(
  callerAddr: string,
  method: string,
  args: any[],
): Promise<{ preparedXdr: string }> {
  if (!callerAddr || !callerAddr.startsWith("G")) return { preparedXdr: "" };
  try {
    const server = getServer();
    const contract = new Contract(PAYROLL_STREAM_CONTRACT_ID);
    const accountData = await server.getAccount(callerAddr);
    const account = new Account(callerAddr, accountData.sequenceNumber());
    const tx = new TransactionBuilder(account, {
      fee: "300",
      networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(60)
      .build();
    const simResult = await server.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(simResult)) {
      throw new Error(simResult.error);
    }
    const assembled = rpc.assembleTransaction(tx, simResult).build();
    return { preparedXdr: assembled.toXDR() };
  } catch {
    return { preparedXdr: "" };
  }
}

export async function buildWithdrawTx(
  callerOrStreamId: bigint | string,
  workerOrStreamId?: string | bigint,
): Promise<{ preparedXdr: string }> {
  const caller =
    typeof callerOrStreamId === "string"
      ? callerOrStreamId
      : String(workerOrStreamId ?? "");
  const streamId =
    typeof callerOrStreamId === "bigint"
      ? callerOrStreamId
      : ((workerOrStreamId as bigint) ?? 0n);
  return buildSorobanTx(caller, "withdraw", [toU64(streamId)]);
}

export async function buildCancelStreamTx(
  callerOrStreamId: string | bigint,
  streamId?: bigint | string,
): Promise<{ preparedXdr: string }> {
  const caller = typeof callerOrStreamId === "string" ? callerOrStreamId : "";
  const id =
    typeof callerOrStreamId === "bigint"
      ? callerOrStreamId
      : typeof streamId === "bigint"
        ? streamId
        : BigInt(streamId ?? 0);
  return buildSorobanTx(caller, "cancel_stream", [toU64(id)]);
}

export async function buildPauseStreamTx(
  callerOrStreamId: string | bigint,
  streamId?: bigint | string,
): Promise<{ preparedXdr: string }> {
  const caller = typeof callerOrStreamId === "string" ? callerOrStreamId : "";
  const id =
    typeof callerOrStreamId === "bigint"
      ? callerOrStreamId
      : typeof streamId === "bigint"
        ? streamId
        : BigInt(streamId ?? 0);
  return buildSorobanTx(caller, "pause_stream", [toU64(id)]);
}

export async function buildResumeStreamTx(
  callerOrStreamId: string | bigint,
  streamId?: bigint | string,
): Promise<{ preparedXdr: string }> {
  const caller = typeof callerOrStreamId === "string" ? callerOrStreamId : "";
  const id =
    typeof callerOrStreamId === "bigint"
      ? callerOrStreamId
      : typeof streamId === "bigint"
        ? streamId
        : BigInt(streamId ?? 0);
  return buildSorobanTx(caller, "resume_stream", [toU64(id)]);
}

export async function buildBatchCreateStreamsTx(
  employer: string,
  entries: BatchStreamEntry[],
): Promise<{ preparedXdr: string }> {
  if (!employer || !employer.startsWith("G") || entries.length === 0) {
    return { preparedXdr: "" };
  }
  const e = entries[0];
  const rate = e.ratePerSecond ?? e.rate ?? 0n;
  return buildSorobanTx(employer, "create_stream", [
    toAddress(e.worker),
    toAddress(e.token),
    toU64(rate),
    toU64(BigInt(e.startTs)),
    toU64(BigInt(e.endTs)),
    toU64(BigInt(e.cliffTs ?? e.startTs)),
    nativeToScVal(e.metadataHash ?? "", { type: "string" }),
  ]);
}

export async function submitAndAwaitTx(
  signedXdr: string,
  _opts?: unknown,
): Promise<string> {
  const server = getServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, networkPassphrase);
  const sendResult = await server.sendTransaction(tx);
  if (sendResult.status === "ERROR") {
    throw new Error("Transaction failed to submit");
  }
  const hash = sendResult.hash;
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const status = await server.getTransaction(hash);
    if (status.status === rpc.Api.GetTransactionStatus.SUCCESS) return hash;
    if (status.status === rpc.Api.GetTransactionStatus.FAILED) {
      throw new Error("Transaction failed");
    }
  }
  return hash;
}

// ─── Decimal helpers (7-decimal Stellar stroops) ─────────────────────────────

const STROOP = 10 ** USDC_DECIMALS;

export function usdcToFloat(stroops: bigint): number {
  return Number(stroops) / STROOP;
}

export function floatToUsdc(amount: number): bigint {
  return BigInt(Math.round(amount * STROOP));
}

// ─── Backwards-compat aliases ─────────────────────────────────────────────────

export { PAYROLL_STREAM_ADDRESS as PAYROLL_STREAM_CONTRACT_ID };
export type { ContractStream as ContractStreamType };
