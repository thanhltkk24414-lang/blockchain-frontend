import { getAddress, type Abi, type Address } from 'viem';
import { contracts } from '@/lib/contracts/config';
import { CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { sendContractCall } from '@/lib/utils/sendContractCall';

export async function sendSetPausedTx(paused: boolean): Promise<`0x${string}`> {
  return sendContractCall({
    address: CONTRACT_ADDRESSES.EscrowVault,
    abi: contracts.escrowVault.abi as Abi,
    functionName: 'setPaused',
    args: [paused],
  });
}

export async function sendGrantEscrowRoleTx(
  grantee: Address,
  role: bigint,
): Promise<`0x${string}`> {
  return sendContractCall({
    address: CONTRACT_ADDRESSES.EscrowVault,
    abi: contracts.escrowVault.abi as Abi,
    functionName: 'grantRole',
    args: [getAddress(grantee), role],
  });
}

export async function sendRevokeEscrowRoleTx(
  grantee: Address,
  role: bigint,
): Promise<`0x${string}`> {
  return sendContractCall({
    address: CONTRACT_ADDRESSES.EscrowVault,
    abi: contracts.escrowVault.abi as Abi,
    functionName: 'revokeRole',
    args: [getAddress(grantee), role],
  });
}

export async function sendGrantPanelRoleTx(
  grantee: Address,
  role: bigint,
): Promise<`0x${string}`> {
  return sendContractCall({
    address: CONTRACT_ADDRESSES.ArbitratorPanel,
    abi: contracts.arbitratorPanel.abi as Abi,
    functionName: 'grantRole',
    args: [getAddress(grantee), role],
  });
}

export async function sendRevokePanelRoleTx(
  grantee: Address,
  role: bigint,
): Promise<`0x${string}`> {
  return sendContractCall({
    address: CONTRACT_ADDRESSES.ArbitratorPanel,
    abi: contracts.arbitratorPanel.abi as Abi,
    functionName: 'revokeRole',
    args: [getAddress(grantee), role],
  });
}

export async function sendJoinPoolAdminTx(arbitrator: Address): Promise<`0x${string}`> {
  return sendContractCall({
    address: CONTRACT_ADDRESSES.ArbitratorPanel,
    abi: contracts.arbitratorPanel.abi as Abi,
    functionName: 'joinPool',
    args: [getAddress(arbitrator)],
  });
}

export async function sendAdminForceResolveTx(
  jobId: bigint,
  decision: number,
): Promise<`0x${string}`> {
  return sendContractCall({
    address: CONTRACT_ADDRESSES.EscrowVault,
    abi: contracts.escrowVault.abi as Abi,
    functionName: 'adminForceResolve',
    args: [jobId, decision],
  });
}
