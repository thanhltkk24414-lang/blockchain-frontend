import type { Abi, Address } from 'viem';
import { encodeFunctionData, getAddress } from 'viem';
import {
  getAccount,
  sendTransaction,
  simulateContract,
} from '@wagmi/core/actions';
import { wagmiConfig } from '@/config/wagmi';
import { contracts } from '@/lib/contracts/config';
import { CHAIN_ID } from '@/lib/contracts/addresses';
import {
  decodeContractError,
  logContractError,
} from '@/lib/utils/contractWrite';

export type SendCreateJobTxParams = {
  metadataCID: string;
  contractValueUnits: bigint;
  durationSeconds: bigint;
  /** Optional wagmi connected address — must match connector account when set. */
  account?: Address;
};

export type CreateJobTxDebug = {
  account: Address;
  metaMaskFrom: Address | null;
  rainbowKitHint: Address | null;
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

function jobRegistryAddress(): Address {
  return getAddress(contracts.jobRegistry.address);
}

/**
 * createJob — preflight via public RPC simulateContract; sign via wagmi sendTransaction only.
 * No custom eth_sendTransaction, no manual walletClient, no injected-provider fallbacks.
 */
export async function sendCreateJobTx({
  metadataCID,
  contractValueUnits,
  durationSeconds,
  account: connectedHint,
}: SendCreateJobTxParams): Promise<`0x${string}`> {
  const chainId = CHAIN_ID as 11155111;
  const trimmedCid = metadataCID.trim();
  const args = [trimmedCid, contractValueUnits, durationSeconds] as const;
  const to = jobRegistryAddress();

  const { address, status, chainId: connectedChainId } = getAccount(wagmiConfig);
  if (status !== 'connected' || !address) {
    throw new Error('Connect your MetaMask wallet on Sepolia before calling createJob.');
  }

  const signingAccount = getAddress(address);

  if (
    connectedHint &&
    signingAccount.toLowerCase() !== connectedHint.toLowerCase() &&
    import.meta.env.DEV
  ) {
    console.warn('[createJob] wagmi account hint mismatch', {
      connectedHint,
      signingAccount,
    });
  }

  if (connectedChainId != null && connectedChainId !== chainId) {
    throw new Error(
      `MetaMask must be on Sepolia (chainId ${chainId}) — currently: ${connectedChainId}.`,
    );
  }

  const data = encodeFunctionData({
    abi: contracts.jobRegistry.abi as Abi,
    functionName: 'createJob',
    args: [...args],
  });

  try {
    await simulateContract(wagmiConfig, {
      address: to,
      abi: contracts.jobRegistry.abi as Abi,
      functionName: 'createJob',
      args: [...args],
      account: signingAccount,
      chainId,
    });
  } catch (simErr) {
    logContractError('createJob simulateContract', simErr);
    throw new Error(decodeContractError(simErr, contracts.jobRegistry.abi as Abi, 'createJob'));
  }

  if (import.meta.env.DEV) {
    console.debug('[createJob] preflight OK', {
      signingAccount,
      chainId,
      jobRegistry: to,
      calldataLength: data.length,
    });
  }

  try {
    const hash = await sendTransaction(wagmiConfig, {
      chainId,
      to,
      data,
    });
    if (import.meta.env.DEV) {
      console.debug('[createJob] sendTransaction OK', hash);
    }
    return hash;
  } catch (err) {
    logContractError('createJob sendTransaction', err);
    throw new Error(decodeContractError(err, contracts.jobRegistry.abi as Abi, 'createJob'));
  }
}

export function buildCreateJobTxDebug(
  signingAccount: Address,
  metadataCID: string,
  contractValueUnits: bigint,
  durationSeconds: bigint,
  rainbowKitHint?: Address | null,
): CreateJobTxDebug {
  const { calldataLength } = previewCreateJobCalldata({
    metadataCID,
    contractValueUnits,
    durationSeconds,
  });
  return {
    account: signingAccount,
    metaMaskFrom: signingAccount,
    rainbowKitHint: rainbowKitHint ?? null,
    chainId: CHAIN_ID,
    jobRegistry: jobRegistryAddress(),
    calldataLength,
  };
}
