import { useCallback, useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseEventLogs, waitForTransactionReceipt, type Abi } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { executeContractWrite } from '@/lib/utils/contractWrite';
import { toUsdcUnits } from '@/lib/utils/usdc';
import type { TxStatus } from '@/components/shared/TxStatusModal';

export interface CreateJobOnChainParams {
  metadataCID: string;
  contractValue: number;
  durationSeconds: number;
}

export interface CreateJobOnChainResult {
  onchainJobId: number;
  createTxHash: `0x${string}`;
}

function parseJobIdFromReceipt(
  logs: Awaited<ReturnType<typeof waitForTransactionReceipt>>['logs'],
): number {
  const events = parseEventLogs({
    abi: contracts.jobRegistry.abi as Abi,
    eventName: 'JobCreated',
    logs,
  });
  if (events.length === 0) {
    throw new Error('JobCreated event not found — kiểm tra giao dịch trên Etherscan.');
  }
  const jobId = events[0].args.jobId;
  const numeric = Number(jobId);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid on-chain job id: ${jobId}`);
  }
  return numeric;
}

export function useCreateJob() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [txLabel, setTxLabel] = useState('');
  const [txError, setTxError] = useState<string>();

  const resetTx = useCallback(() => {
    setTxStatus('idle');
    setTxHash('');
    setTxLabel('');
    setTxError(undefined);
  }, []);

  const createOnChain = useCallback(
    async ({
      metadataCID,
      contractValue,
      durationSeconds,
    }: CreateJobOnChainParams): Promise<CreateJobOnChainResult> => {
      if (!address) {
        throw new Error('Kết nối ví MetaMask trên Sepolia trước khi tạo job on-chain.');
      }

      resetTx();
      setTxStatus('pending');
      setTxLabel('Creating job on JobRegistry…');

      try {
        const hash = await executeContractWrite(writeContractAsync, {
          address: contracts.jobRegistry.address,
          abi: contracts.jobRegistry.abi as Abi,
          functionName: 'createJob',
          args: [metadataCID, toUsdcUnits(contractValue), BigInt(durationSeconds)],
          account: address,
        });
        setTxHash(hash);

        const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
        if (receipt.status === 'reverted') {
          throw new Error('createJob revert on-chain — kiểm tra reputation tier và gas ETH.');
        }

        const onchainJobId = parseJobIdFromReceipt(receipt.logs);
        setTxStatus('success');
        setTxLabel('Job created on-chain');
        return { onchainJobId, createTxHash: hash };
      } catch (err) {
        setTxStatus('failed');
        setTxError(err instanceof Error ? err.message : 'createJob failed');
        throw err;
      }
    },
    [address, resetTx, writeContractAsync],
  );

  return {
    createOnChain,
    txStatus,
    txHash,
    txLabel,
    txError,
    resetTx,
  };
}
