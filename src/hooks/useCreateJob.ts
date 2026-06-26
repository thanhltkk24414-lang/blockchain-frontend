import { useCallback, useState } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { readContract, waitForTransactionReceipt } from 'wagmi/actions';
import { getAddress, isAddress, parseEventLogs, type Abi, type Log } from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CHAIN_ID, CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import { decodeContractError, logContractError } from '@/lib/utils/contractWrite';
import {
  buildCreateJobTxDebug,
  sendCreateJobTx,
  type CreateJobTxDebug,
} from '@/lib/utils/sendCreateJobTx';
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

const RESTRICTED_TIER = 0;

function parseJobIdFromReceipt(logs: Log[]): number {
  const events = parseEventLogs({
    abi: contracts.jobRegistry.abi as Abi,
    eventName: 'JobCreated',
    logs,
  });
  if (events.length === 0) {
    throw new Error('JobCreated event not found — kiểm tra giao dịch trên Etherscan.');
  }
  const jobId = (events[0].args as { jobId: bigint }).jobId;
  const numeric = Number(jobId);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid on-chain job id: ${jobId}`);
  }
  return numeric;
}

function assertCreateJobParams({
  metadataCID,
  contractValue,
  durationSeconds,
}: CreateJobOnChainParams): void {
  const cid = metadataCID?.trim();
  if (!cid) {
    throw new Error('metadataCID trống — upload IPFS phải hoàn tất trước createJob.');
  }
  if (!Number.isFinite(contractValue) || contractValue < 1) {
    throw new Error('Budget phải ≥ 1 USDC (on-chain dùng 6 decimals: 1 USDC = 1_000_000 units).');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds < 3600) {
    throw new Error('Duration on-chain phải ≥ 3600 giây (1 giờ). Form dùng ngày × 86400.');
  }
}

export function useCreateJob() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [txStatus, setTxStatus] = useState<TxStatus>('idle');
  const [txHash, setTxHash] = useState('');
  const [txLabel, setTxLabel] = useState('');
  const [txError, setTxError] = useState<string>();
  const [txDebug, setTxDebug] = useState<CreateJobTxDebug | null>(null);

  const resetTx = useCallback(() => {
    setTxStatus('idle');
    setTxHash('');
    setTxLabel('');
    setTxError(undefined);
    setTxDebug(null);
  }, []);

  const createOnChain = useCallback(
    async (params: CreateJobOnChainParams): Promise<CreateJobOnChainResult> => {
      if (!isConnected || !address) {
        throw new Error('Kết nối ví MetaMask trên Sepolia trước khi tạo job on-chain.');
      }
      if (!isAddress(address)) {
        const len = String(address).length;
        throw new Error(
          `Địa chỉ MetaMask không hợp lệ (${len} ký tự). Cần đúng định dạng 0x + 40 ký tự hex.`,
        );
      }
      if (chainId !== CHAIN_ID) {
        try {
          await switchChainAsync({ chainId: CHAIN_ID });
        } catch (switchErr) {
          logContractError('switchChain Sepolia', switchErr);
          throw new Error(
            `MetaMask đang ở chain ${chainId ?? 'unknown'} — chuyển sang Sepolia (${CHAIN_ID}).`,
          );
        }
      }

      const client = getAddress(address);
      const { metadataCID, contractValue, durationSeconds } = params;
      assertCreateJobParams(params);

      resetTx();
      setTxStatus('pending');
      setTxLabel('Creating job on JobRegistry…');

      try {
        const tier = (await readContract(wagmiConfig, {
          ...contracts.reputationStore,
          functionName: 'getTier',
          args: [client],
        })) as number;
        if (tier === RESTRICTED_TIER) {
          throw new Error(
            'AccountRestricted: Reputation tier Restricted — ví này không được gọi JobRegistry.createJob.',
          );
        }

        const valueUnits = toUsdcUnits(contractValue);
        const durationBig = BigInt(Math.round(durationSeconds));
        const debug = buildCreateJobTxDebug(
          client,
          metadataCID.trim(),
          valueUnits,
          durationBig,
        );
        setTxDebug(debug);
        if (import.meta.env.DEV) {
          console.debug('[createJob] tx debug', debug);
        }

        const hash = await sendCreateJobTx({
          metadataCID: metadataCID.trim(),
          contractValueUnits: valueUnits,
          durationSeconds: durationBig,
          account: client,
        });
        setTxHash(hash);

        const receipt = await waitForTransactionReceipt(wagmiConfig, { hash });
        if (receipt.status === 'reverted') {
          throw new Error(
            `createJob revert on-chain (JobRegistry ${CONTRACT_ADDRESSES.JobRegistry}). ` +
              'Kiểm tra reputation tier và Sepolia ETH.',
          );
        }

        const onchainJobId = parseJobIdFromReceipt(receipt.logs);
        setTxStatus('success');
        setTxLabel('Job created on-chain');
        return { onchainJobId, createTxHash: hash };
      } catch (err) {
        logContractError('createOnChain', err);
        const message = decodeContractError(
          err,
          contracts.jobRegistry.abi as Abi,
          'createJob',
        );
        setTxStatus('failed');
        setTxError(message);
        throw new Error(message);
      }
    },
    [address, chainId, isConnected, resetTx, switchChainAsync],
  );

  return {
    createOnChain,
    txStatus,
    txHash,
    txLabel,
    txError,
    txDebug,
    resetTx,
  };
}
