import { useCallback } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { readContract } from 'wagmi/actions';
import type { Abi } from 'viem';
import { getAddress, keccak256, encodePacked, toBytes } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { executeContractWrite } from '@/lib/utils/contractWrite';
import { addressesEqual } from '@/lib/utils/address';
import { useContractTx } from './useContractTx';

export const VOTE_CHOICES = {
  FREELANCER_WIN: 1,
  CLIENT_WIN: 2,
  SPLIT: 3,
} as const;

export function computeVoteHash(choice: number, salt: string): `0x${string}` {
  return keccak256(encodePacked(['uint256', 'string'], [BigInt(choice), salt]));
}

export function cidToEvidenceHash(cid: string): `0x${string}` {
  return keccak256(toBytes(cid));
}

export function useDisputeActions() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const tx = useContractTx();

  const submitEvidence = useCallback(
    async (onchainJobId: number, cid: string) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);
      const hash = cidToEvidenceHash(cid);

      await tx.runTx('Đang nộp bằng chứng on-chain…', () =>
        executeContractWrite(writeContractAsync, {
          address: contracts.arbitratorPanel.address,
          abi: contracts.arbitratorPanel.abi as Abi,
          functionName: 'submitEvidence',
          args: [BigInt(onchainJobId), hash],
          account: wallet,
        }),
      );
    },
    [address, tx, writeContractAsync],
  );

  const commitVote = useCallback(
    async (onchainJobId: number, choice: number, salt: string) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);
      const hash = computeVoteHash(choice, salt);

      await tx.runTx('Đang commit vote…', () =>
        executeContractWrite(writeContractAsync, {
          address: contracts.arbitratorPanel.address,
          abi: contracts.arbitratorPanel.abi as Abi,
          functionName: 'commitVote',
          args: [BigInt(onchainJobId), hash],
          account: wallet,
        }),
      );
    },
    [address, tx, writeContractAsync],
  );

  const revealVote = useCallback(
    async (onchainJobId: number, choice: number, salt: string) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);

      await tx.runTx('Đang reveal vote…', () =>
        executeContractWrite(writeContractAsync, {
          address: contracts.arbitratorPanel.address,
          abi: contracts.arbitratorPanel.abi as Abi,
          functionName: 'revealVote',
          args: [BigInt(onchainJobId), choice, salt],
          account: wallet,
        }),
      );
    },
    [address, tx, writeContractAsync],
  );

  const finalizeDisputeVoting = useCallback(
    async (onchainJobId: number) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);

      await tx.runTx('Đang finalize dispute voting…', () =>
        executeContractWrite(writeContractAsync, {
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'finalizeDisputeVoting',
          args: [BigInt(onchainJobId)],
          account: wallet,
        }),
      );
    },
    [address, tx, writeContractAsync],
  );

  const executeArbitrationResult = useCallback(
    async (onchainJobId: number) => {
      if (!address) throw new Error('Hãy kết nối ví MetaMask trước.');
      const wallet = getAddress(address);

      await tx.runTx('Đang thực thi kết quả phân xử…', () =>
        executeContractWrite(writeContractAsync, {
          address: contracts.escrowVault.address,
          abi: contracts.escrowVault.abi as Abi,
          functionName: 'executeArbitrationResult',
          args: [BigInt(onchainJobId)],
          account: wallet,
        }),
      );
    },
    [address, tx, writeContractAsync],
  );

  return {
    submitEvidence,
    commitVote,
    revealVote,
    finalizeDisputeVoting,
    executeArbitrationResult,
    ...tx,
  };
}

export async function readChosenArbitrators(onchainJobId: number): Promise<string[]> {
  const arbs = (await readContract(wagmiConfig, {
    address: contracts.arbitratorPanel.address,
    abi: contracts.arbitratorPanel.abi as Abi,
    functionName: 'getChosenArbitrators',
    args: [BigInt(onchainJobId)],
  })) as `0x${string}`[];
  return arbs.map((a) => a.toLowerCase());
}

export function isAssignedArbitrator(arbitrators: string[], wallet?: string | null): boolean {
  if (!wallet) return false;
  const w = wallet.toLowerCase();
  return arbitrators.some((a) => addressesEqual(a, w));
}
