import type { Abi, Address, Hash } from 'viem';
import { encodeFunctionData, getAddress } from 'viem';
import { sepolia } from 'viem/chains';
import { getWalletClient, simulateContract } from 'wagmi/actions';
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
  getSigningProvider,
  type EthereumProvider,
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

function jobRegistryAddress(): Address {
  return getAddress(contracts.jobRegistry.address);
}

/** Minimal eth_sendTransaction shape MetaMask accepts for nonpayable calls (no value field). */
type EthSendTxParams = {
  to: Address;
  data: `0x${string}`;
  from?: Address;
};

function logEthSendParams(label: string, params: EthSendTxParams): void {
  if (!import.meta.env.DEV) return;
  console.debug(`[createJob] ${label}`, {
    method: 'eth_sendTransaction',
    params: [params],
    from: params.from ?? '(omitted — MetaMask picks active account)',
    to: params.to,
    dataLength: params.data.length,
    dataPrefix: params.data.slice(0, 74),
  });
}

async function ethSendCreateJob(
  provider: EthereumProvider,
  data: `0x${string}`,
  from?: Address,
): Promise<Hash> {
  const txParams: EthSendTxParams = {
    to: jobRegistryAddress(),
    data,
  };
  if (from) txParams.from = getAddress(from);
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

async function sendViaWalletClient(from: Address, data: `0x${string}`): Promise<Hash> {
  const walletClient = await getWalletClient(wagmiConfig, { chainId: CHAIN_ID as 11155111 });
  if (!walletClient?.account) {
    throw new Error('Wallet client không khả dụng — kết nối MetaMask trên Sepolia.');
  }
  return walletClient.sendTransaction({
    account: getAddress(from),
    chain: sepolia,
    to: jobRegistryAddress(),
    data,
  });
}

async function signCreateJob(
  provider: EthereumProvider,
  signingAccount: Address,
  data: `0x${string}`,
): Promise<Hash> {
  const strategies: Array<{ name: string; run: () => Promise<Hash> }> = [
    {
      name: 'walletClient.sendTransaction',
      run: () => sendViaWalletClient(signingAccount, data),
    },
    {
      name: 'eth_sendTransaction (to+data only)',
      run: () => ethSendCreateJob(provider, data),
    },
    {
      name: 'eth_sendTransaction (from+to+data)',
      run: () => ethSendCreateJob(provider, data, signingAccount),
    },
  ];

  let lastErr: unknown;
  for (const { name, run } of strategies) {
    try {
      const hash = await run();
      if (import.meta.env.DEV) {
        console.debug(`[createJob] signed via ${name}`, hash);
      }
      return hash;
    } catch (err) {
      if (!isInvalidTxParamsError(err)) {
        throw err;
      }
      logContractError(`createJob ${name}`, err);
      lastErr = err;
    }
  }

  throw lastErr;
}

/**
 * createJob signer — preflight via public RPC; signing via wagmi walletClient or
 * minimal eth_sendTransaction (no value / optional from).
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

  const provider = await getSigningProvider();
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
    address: jobRegistryAddress(),
    abi: contracts.jobRegistry.abi as Abi,
    functionName: 'createJob',
    args: [...args],
    account: signingAccount,
  });

  try {
    await simulateContract(wagmiConfig, {
      address: jobRegistryAddress(),
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
      jobRegistry: jobRegistryAddress(),
      calldataLength: data.length,
    });
  }

  try {
    return await signCreateJob(provider, signingAccount, data);
  } catch (err) {
    logContractError('createJob sign', err);

    if (isInvalidTxParamsError(err)) {
      if (import.meta.env.DEV) {
        console.warn('[createJob] -32602 — retrying after wallet_requestPermissions');
      }
      try {
        await requestMetaMaskPermissions(provider);
        signingAccount = await resolveMetaMaskSigningAccount();
        return await signCreateJob(provider, signingAccount, data);
      } catch (retryErr) {
        logContractError('createJob sign retry', retryErr);
        const base = decodeContractError(retryErr, contracts.jobRegistry.abi as Abi, 'createJob');
        throw new Error(
          `${base} Thử Disconnect → Connect lại MetaMask trên Fapex, hoặc tắt ví khác (Coinbase/Brave) nếu cài song song.`,
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
    jobRegistry: jobRegistryAddress(),
    calldataLength,
  };
}
