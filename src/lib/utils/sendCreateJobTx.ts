import type { Abi, Address, Hash } from 'viem';
import { encodeFunctionData } from 'viem';
import { simulateContract } from 'wagmi/actions';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CHAIN_ID } from '@/lib/contracts/addresses';
import { withGasLimit } from '@/lib/utils/contractGas';
import {
  decodeContractError,
  logContractError,
} from '@/lib/utils/contractWrite';
import {
  ensureSepoliaOnProvider,
  getMetaMaskProvider,
} from '@/lib/utils/ethereumProvider';

export type SendCreateJobTxParams = {
  metadataCID: string;
  contractValueUnits: bigint;
  durationSeconds: bigint;
  account: Address;
};

export type CreateJobTxDebug = {
  account: Address;
  chainId: number;
  jobRegistry: Address;
  calldataLength: number;
};

/** Preview calldata size for dev debug panel (no wallet / RPC). */
export function previewCreateJobCalldata(params: Omit<SendCreateJobTxParams, 'account'>): {
  data: `0x${string}`;
  calldataLength: number;
} {
  const data = encodeFunctionData({
    abi: contracts.jobRegistry.abi as Abi,
    functionName: 'createJob',
    args: [params.metadataCID.trim(), params.contractValueUnits, params.durationSeconds],
  });
  return { data, calldataLength: data.length };
}

/**
 * createJob signer — uses window.ethereum eth_sendTransaction as primary path
 * (MetaMask on Windows often rejects wagmi/viem gas/fee fields from RainbowKit).
 */
export async function sendCreateJobTx({
  metadataCID,
  contractValueUnits,
  durationSeconds,
  account,
}: SendCreateJobTxParams): Promise<`0x${string}`> {
  const chainId = CHAIN_ID as 11155111;
  const trimmedCid = metadataCID.trim();
  const args = [trimmedCid, contractValueUnits, durationSeconds] as const;

  const { gas } = await withGasLimit({
    address: contracts.jobRegistry.address,
    abi: contracts.jobRegistry.abi as Abi,
    functionName: 'createJob',
    args: [...args],
    account,
  });

  try {
    await simulateContract(wagmiConfig, {
      address: contracts.jobRegistry.address,
      abi: contracts.jobRegistry.abi as Abi,
      functionName: 'createJob',
      args: [...args],
      account,
      gas,
      chainId,
    });
  } catch (simErr) {
    logContractError('createJob simulateContract', simErr);
    throw new Error(decodeContractError(simErr, contracts.jobRegistry.abi as Abi, 'createJob'));
  }

  const data = encodeFunctionData({
    abi: contracts.jobRegistry.abi as Abi,
    functionName: 'createJob',
    args: [...args],
  });

  if (import.meta.env.DEV) {
    console.debug('[createJob] preflight OK', {
      account,
      chainId,
      jobRegistry: contracts.jobRegistry.address,
      calldataLength: data.length,
    });
  }

  const provider = getMetaMaskProvider();
  if (!provider) {
    throw new Error('MetaMask provider không khả dụng — cài/kích hoạt extension và refresh trang.');
  }

  await ensureSepoliaOnProvider(provider);

  try {
    const hash = (await provider.request({
      method: 'eth_sendTransaction',
      params: [
        {
          from: account,
          to: contracts.jobRegistry.address,
          data,
          value: '0x0',
        },
      ],
    })) as Hash;

    if (import.meta.env.DEV) {
      console.debug('[createJob] signed via eth_sendTransaction (primary)', hash);
    }
    return hash;
  } catch (err) {
    logContractError('createJob eth_sendTransaction', err);
    throw new Error(decodeContractError(err, contracts.jobRegistry.abi as Abi, 'createJob'));
  }
}

export function buildCreateJobTxDebug(
  account: Address,
  metadataCID: string,
  contractValueUnits: bigint,
  durationSeconds: bigint,
): CreateJobTxDebug {
  const { calldataLength } = previewCreateJobCalldata({
    metadataCID,
    contractValueUnits,
    durationSeconds,
  });
  return {
    account,
    chainId: CHAIN_ID,
    jobRegistry: contracts.jobRegistry.address,
    calldataLength,
  };
}
