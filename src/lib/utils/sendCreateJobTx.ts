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
import {
  isInvalidTxParamsError,
  requestMetaMaskPermissions,
  resolveMetaMaskSigningAccount,
} from '@/lib/utils/walletAccounts';

export type SendCreateJobTxParams = {
  metadataCID: string;
  contractValueUnits: bigint;
  durationSeconds: bigint;
  /** wagmi connected address hint — actual `from` comes from MetaMask eth_accounts[0]. */
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

type EthSendTxParams = {
  from: Address;
  to: Address;
  data: `0x${string}`;
  value: `0x${string}`;
};

function logEthSendParams(label: string, params: EthSendTxParams): void {
  if (!import.meta.env.DEV) return;
  console.debug(`[createJob] ${label}`, {
    method: 'eth_sendTransaction',
    params: [params],
    from: params.from,
    to: params.to,
    dataLength: params.data.length,
    dataPrefix: params.data.slice(0, 74),
    value: params.value,
  });
}

async function ethSendCreateJob(
  provider: NonNullable<ReturnType<typeof getMetaMaskProvider>>,
  from: Address,
  data: `0x${string}`,
): Promise<Hash> {
  const txParams: EthSendTxParams = {
    from,
    to: contracts.jobRegistry.address,
    data,
    value: '0x0',
  };
  logEthSendParams('eth_sendTransaction request', txParams);

  const hash = (await provider.request({
    method: 'eth_sendTransaction',
    params: [txParams],
  })) as Hash;

  if (import.meta.env.DEV) {
    console.debug('[createJob] eth_sendTransaction response', hash);
  }
  return hash;
}

/**
 * createJob signer — uses MetaMask eth_accounts[0] as `from` (not wagmi cache alone).
 * MetaMask -32602 when `from` ∉ eth_accounts — thường do đổi account trong extension.
 */
export async function sendCreateJobTx({
  metadataCID,
  contractValueUnits,
  durationSeconds,
  account: rainbowKitHint,
}: SendCreateJobTxParams): Promise<`0x${string}`> {
  const chainId = CHAIN_ID as 11155111;
  const trimmedCid = metadataCID.trim();
  const args = [trimmedCid, contractValueUnits, durationSeconds] as const;

  const provider = getMetaMaskProvider();
  if (!provider) {
    throw new Error('MetaMask provider không khả dụng — cài/kích hoạt extension và refresh trang.');
  }

  await ensureSepoliaOnProvider(provider);

  let signingAccount = await resolveMetaMaskSigningAccount();

  if (
    rainbowKitHint &&
    signingAccount.toLowerCase() !== rainbowKitHint.toLowerCase() &&
    import.meta.env.DEV
  ) {
    console.warn('[createJob] Fapex connected ≠ MetaMask active', {
      connected: rainbowKitHint,
      metaMaskActive: signingAccount,
    });
  }

  const { gas } = await withGasLimit({
    address: contracts.jobRegistry.address,
    abi: contracts.jobRegistry.abi as Abi,
    functionName: 'createJob',
    args: [...args],
    account: signingAccount,
  });

  try {
    await simulateContract(wagmiConfig, {
      address: contracts.jobRegistry.address,
      abi: contracts.jobRegistry.abi as Abi,
      functionName: 'createJob',
      args: [...args],
      account: signingAccount,
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
      signingAccount,
      rainbowKitHint: rainbowKitHint ?? null,
      chainId,
      jobRegistry: contracts.jobRegistry.address,
      calldataLength: data.length,
    });
  }

  try {
    return await ethSendCreateJob(provider, signingAccount, data);
  } catch (err) {
    logContractError('createJob eth_sendTransaction', err);

    if (isInvalidTxParamsError(err)) {
      if (import.meta.env.DEV) {
        console.warn('[createJob] -32602 — retrying after wallet_requestPermissions');
      }
      try {
        await requestMetaMaskPermissions(provider);
        signingAccount = await resolveMetaMaskSigningAccount();
        return await ethSendCreateJob(provider, signingAccount, data);
      } catch (retryErr) {
        logContractError('createJob eth_sendTransaction retry', retryErr);
        const base = decodeContractError(retryErr, contracts.jobRegistry.abi as Abi, 'createJob');
        throw new Error(
          `${base} Chọn đúng Account trong MetaMask, Disconnect/Connect lại trên Fapex, rồi thử lại.`,
        );
      }
    }

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
    jobRegistry: contracts.jobRegistry.address,
    calldataLength,
  };
}
