/**
 * workforce_registry.ts — NOT YET IMPLEMENTED FOR ARC
 *
 * The WorkforceRegistry (Soroban) has no ARC/EVM counterpart yet.
 * Worker metadata can be stored off-chain (IPFS) with on-chain hashes
 * in a future Registry contract.
 */

export const WORKFORCE_REGISTRY_CONTRACT_ID = "" as const;

export interface WorkerRecord {
  address: string;
  name: string;
  department: string;
  wallet: string;
  metadata_hash: string;
  preferred_token: string;
}

export async function getWorkerRecord(_address: string): Promise<WorkerRecord | null> {
  return null;
}

export async function getWorkersByEmployer(_employer: string, _caller?: string): Promise<WorkerRecord[]> {
  return [];
}

export interface WorkerProfile {
  address: string;
  name: string;
  department?: string;
  wallet: string;
  metadata_hash: string;
  preferred_token: string;
}

export async function getWorkerProfile(_employer: string, _worker: string): Promise<WorkerProfile | null> {
  return null;
}

export async function buildSetStreamActiveTx(
  _employer: string,
  _worker: string,
  _active: boolean,
): Promise<{ preparedXdr: string }> {
  return { preparedXdr: "" };
}

export async function buildRegisterWorkerTx(
  _workerOrEmployer: string,
  _employerOrWorker: string,
  _profile?: Partial<WorkerProfile>,
): Promise<{ preparedXdr: string }> {
  return { preparedXdr: '' };
}

export async function isWorkerRegistered(_employer: string, _worker: string): Promise<boolean> {
  return false;
}
