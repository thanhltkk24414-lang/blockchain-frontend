import { getWalletClient, simulateContract, writeContract } from 'wagmi/actions';
import { sepolia } from 'wagmi/chains';
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  encodeFunctionData,
  getAddress,
  isAddress,
  type Abi,
  type Address,
  type Hash,
  type WalletClient,
} from 'viem';
import { wagmiConfig } from '@/config/wagmi';
import { CHAIN_ID } from '@/lib/contracts/addresses';
import { withGasLimit, type GasEstimateInput } from '@/lib/utils/contractGas';

const REVERT_HINTS: Record<string, string> = {
  WrongStatus:
    'Invalid on-chain job status. depositEscrow requires OPEN; if already ASSIGNED (often from assignFreelancer), create a new job.',
  OnlyClient: 'Only the on-chain client (JobRegistry creator) can call this function.',
  OnlyFreelancer:
    'Only the freelancer assigned at escrow deposit can call this — check MetaMask wallet.',
  Unauthorized: 'Wallet is not authorized for this transaction.',
  ContractPaused: 'Contract is paused (emergency pause).',
  TransferFailed:
    'USDC transfer failed — check MockUSDC balance and allowance (need job value on-chain + 3% fee).',
  LowReputationTier: 'Reputation tier too low for this action.',
  AccountRestricted:
    'Reputation tier Restricted (score < 50) — cannot create jobs or perform this action.',
  JobNotOpen: 'Job is not OPEN — cannot assign freelancer via depositEscrow.',
  StartWindowExpired:
    'More than 72 hours since assignment — client may cancel the contract. Contact the client.',
};

const REVERT_HINTS_BY_FN: Record<string, Record<string, string>> = {
  createJob: {
    AccountRestricted:
      'Client wallet has Restricted tier — cannot call createJob. Use another wallet or ask admin to update reputation.',
    InvalidJob: 'Invalid job parameters — check USDC budget (> 0) and duration (seconds).',
  },
  submitWork: {
    WrongStatus:
      'Job has not started — call startWork first (submitWork only when IN_PROGRESS).',
    OnlyFreelancer:
      'MetaMask wallet does not match on-chain freelancer. Switch to the wallet assigned at escrow deposit.',
  },
  startWork: {
    WrongStatus: 'startWork only when job is ASSIGNED (after depositEscrow).',
    OnlyFreelancer:
      'MetaMask wallet does not match on-chain freelancer. Switch to the wallet assigned at escrow deposit.',
    StartWindowExpired:
      'More than 72 hours since assignment — client may cancel the contract.',
  },
  approveAndRelease: {
    WrongStatus:
      'approveAndRelease only when job is SUBMITTED (freelancer called submitWork).',
    OnlyClient:
      'Only the on-chain client can approve — switch to the correct client wallet in MetaMask.',
    ContractPaused: 'EscrowVault is paused — try again later.',
    TransferFailed: 'USDC transfer failed — escrow may not hold enough funds for this job.',
  },
  raiseDispute: {
    WrongStatus:
      'raiseDispute only when job is SUBMITTED or IN_PROGRESS (not COMPLETED).',
    NotAParty: 'Only on-chain client or freelancer can raise a dispute — switch MetaMask wallet.',
    AlreadyDisputed: 'Job was already disputed — cannot open again.',
    LowReputationTier: 'Warning/Restricted tiers cannot raise new disputes.',
    TransferFailed:
      'Dispute fee USDC transfer failed — check MockUSDC balance and allowance for EscrowVault.',
    NotEnoughArbitrators:
      'Fewer than 5 arbitrators in pool (ArbitratorPanel.poolSize). Admin must joinPool before demo disputes.',
  },
  submitEvidence: {
    JobNotDisputed: 'Job is not DISPUTED — call raiseDispute before submitting evidence.',
    NotAParty:
      'Only on-chain client or freelancer can submit evidence — switch to the correct wallet.',
    EvidenceWindowClosed:
      'Evidence window closed (demo Sepolia: 10 minutes from dispute start).',
  },
  commitVote: {
    AlreadyCommitted: 'You already committed — wait for reveal phase.',
    WrongPhase: 'Commit phase has not started or has ended.',
    NotAnArbitrator: 'Wallet is not on the arbitrator panel for this job.',
  },
  revealVote: {
    AlreadyRevealed: 'You already revealed — no need to send again.',
    NotCommitted: 'No commit found — commit during the commit phase first.',
    HashMismatch: 'Salt or choice does not match commit — check your salt.',
    WrongPhase: 'Reveal phase has not started or has ended.',
    NotAnArbitrator: 'Wallet is not on the arbitrator panel for this job.',
  },
  finalizeDisputeVoting: {
    VotingStillActive: 'Reveal phase still active — wait until it ends.',
    InsufficientQuorum: 'Fewer than 3 valid reveal votes — need more arbitrator reveals.',
    AlreadyResolved: 'Voting was already finalized.',
  },
  stakeAsArbitrator: {
    InsufficientStake: 'Minimum arbitrator stake is 50 USDC (50_000_000 smallest units).',
    TransferFailed:
      'USDC transfer failed — mint MockUSDC (Step 1) and approve PlatformTreasury as spender.',
  },
  joinPool: {
    InsufficientStake: 'Stake at least 50 USDC via PlatformTreasury before joining the pool.',
    LowReputationTier: 'Reputation tier too low — need Normal or Trusted tier in ReputationStore.',
    AlreadyInPool: 'Wallet is already in the arbitrator pool.',
  },
  fileAppeal: {
    AppealAlreadyFiled: 'Appeal already filed for this job.',
    AppealNotAllowed: 'Appeals only in round 1 — round 2 is final.',
    AppealWindowClosed: 'Appeal window closed (demo: 30 minutes after finalize).',
    VotingNotFinalized: 'Voting not finalized yet — wait for Finalize voting.',
    NotAParty: 'Only client or freelancer can file an appeal.',
    TransferFailed: 'Appeal fee USDC transfer failed — check balance and allowance.',
  },
};

function formatDecodedMessage(msg: string, functionName?: string): string {
  if (/invalid address/i.test(msg)) {
    return (
      'Invalid wallet address (need 0x + 40 hex chars). ' +
      'Check MetaMask account — addresses longer than 42 chars are often copy-paste errors.'
    );
  }
  if (/user rejected|user denied|rejected the request/i.test(msg)) {
    return 'You rejected the transaction in MetaMask.';
  }
  if (/chain.?mismatch|wrong network|unsupported chain/i.test(msg)) {
    return `MetaMask must be on Sepolia (chainId ${CHAIN_ID}) before calling ${functionName ?? 'contract'}.`;
  }
  if (/missing or invalid parameters/i.test(msg)) {
    const clean = msg.replace(/^MetaMask RPC:\s*/i, '').trim();
    return (
      `MetaMask RPC: ${clean}. Often caused by multiple wallet extensions — disconnect MetaMask and refresh.`
    );
  }
  if (/transaction creation failed/i.test(msg)) {
    return (
      'MetaMask could not create the transaction — check account, Sepolia network, and ETH for gas.'
    );
  }
  if (/connector account not found|account not found/i.test(msg)) {
    return (
      'MetaMask account not found — select the same account in the extension as connected on FAPEX.'
    );
  }
  if (/reverted.*unknown|out of gas|intrinsic gas too low|missing revert data/i.test(msg)) {
    const gasHint =
      functionName === 'approveAndRelease'
        ? 'approveAndRelease needs ~225k+ gas on Sepolia.'
        : functionName === 'submitWork'
          ? 'submitWork needs ~180k+ gas.'
          : functionName === 'createJob'
            ? 'createJob needs ~120k+ gas; ensure Sepolia ETH.'
            : 'gas limit may be too low.';
    return (
      `Transaction reverted (undecoded). Often ${gasHint} Check MetaMask wallet and job status.`
    );
  }
  return msg;
}

export function decodeContractError(
  err: unknown,
  _abi?: Abi,
  functionName?: string,
): string {
  if (err instanceof BaseError) {
    const rejected = err.walk((e) => e instanceof UserRejectedRequestError);
    if (rejected instanceof UserRejectedRequestError) {
      return 'You rejected the transaction in MetaMask.';
    }

    const revert = err.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | null;

    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name) {
        const fnHint = functionName ? REVERT_HINTS_BY_FN[functionName]?.[name] : undefined;
        const hint = fnHint ?? REVERT_HINTS[name];
        return hint ? `${name}: ${hint}` : `Contract reverted: ${name}`;
      }
      if (revert.reason) {
        return revert.reason;
      }
    }

    const msg = err.shortMessage || err.message;
    return formatDecodedMessage(msg, functionName);
  }

  if (err instanceof Error) {
    return formatDecodedMessage(err.message, functionName);
  }

  return 'Transaction failed';
}

export type ContractWriteInput = GasEstimateInput & {
  /** Optional — when set, must match the MetaMask account Fapex will sign with. */
  account?: Address;
};

import {
  ensureSepoliaOnProvider,
  getMetaMaskProvider,
  getSigningProvider,
  type EthereumProvider,
} from '@/lib/utils/ethereumProvider';
import {
  isInvalidTxParamsError,
  resolveMetaMaskSigningAccount,
} from '@/lib/utils/walletAccounts';

function getInjectedProvider(): EthereumProvider | undefined {
  return getMetaMaskProvider();
}

function isUserRejection(err: unknown): boolean {
  if (err instanceof BaseError) {
    return Boolean(err.walk((e) => e instanceof UserRejectedRequestError));
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /user rejected|user denied|rejected the request/i.test(msg);
}

/** DEV: log viem/wagmi error tree including cause and RPC details. */
export function logContractError(label: string, err: unknown): void {
  if (!import.meta.env.DEV) return;
  if (err instanceof BaseError) {
    console.error(`[contractWrite] ${label}`, {
      shortMessage: err.shortMessage,
      message: err.message,
      details: (err as BaseError & { details?: string }).details,
      cause: err.cause,
      metaMessages: err.metaMessages,
    });
    return;
  }
  if (err instanceof Error) {
    console.error(`[contractWrite] ${label}`, {
      message: err.message,
      cause: err.cause,
    });
    return;
  }
  console.error(`[contractWrite] ${label}`, err);
}

function debugWriteFailure(strategy: string, err: unknown): void {
  logContractError(`${strategy} failed`, err);
}

/**
 * MetaMask (injected provider) rejects eth_sendTransaction when wagmi/viem forwards
 * pre-estimated gas / EIP-1559 fee fields from the public RPC simulate path.
 * Preflight uses gas on the read client only; signing omits gas so MetaMask estimates locally.
 */
async function writeViaWalletClient(
  walletClient: WalletClient,
  params: ContractWriteInput,
): Promise<Hash> {
  return walletClient.writeContract({
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
    value: params.value,
    account: walletClient.account!,
    chain: sepolia,
  });
}

async function writeViaWagmiAction(
  params: ContractWriteInput,
  chainId: 11155111,
): Promise<Hash> {
  return writeContract(wagmiConfig, {
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
    value: params.value,
    chainId,
  });
}

/** Last resort: minimal eth_sendTransaction params MetaMask accepts (to/data only). */
async function writeViaInjectedProvider(
  _wagmiHint: Address,
  params: ContractWriteInput,
): Promise<Hash> {
  const provider = (await getSigningProvider()) ?? getInjectedProvider();
  if (!provider?.request) {
    throw new Error('MetaMask provider unavailable — install or enable the extension.');
  }

  await ensureSepoliaOnProvider(provider);
  const from = await resolveMetaMaskSigningAccount();

  const data = encodeFunctionData({
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
  });

  const to = getAddress(params.address);
  const txMinimal = { to, data };
  const txWithFrom = { from, to, data };

  if (import.meta.env.DEV) {
    console.debug('[contractWrite] eth_sendTransaction request', {
      method: 'eth_sendTransaction',
      params: [txMinimal],
    });
  }

  try {
    return (await provider.request({
      method: 'eth_sendTransaction',
      params: [txMinimal],
    })) as Hash;
  } catch (err) {
    if (!isInvalidTxParamsError(err)) throw err;
    return (await provider.request({
      method: 'eth_sendTransaction',
      params: [txWithFrom],
    })) as Hash;
  }
}

/**
 * Sign a contract write with MetaMask-safe fallbacks:
 * 1) walletClient.writeContract (full Sepolia chain object, no gas field)
 * 2) wagmi writeContract action (chainId only, no gas)
 * 3) raw window.ethereum eth_sendTransaction after encodeFunctionData
 */
export async function sendContractTransaction(
  params: ContractWriteInput,
): Promise<`0x${string}`> {
  if (!params.address || !isAddress(params.address)) {
    throw new Error(
      `Invalid contract address (${String(params.address)}). Check VITE_JOB_REGISTRY_ADDRESS / deployments-sepolia.json.`,
    );
  }

  const chainId = CHAIN_ID as 11155111;

  const walletClient = await getWalletClient(wagmiConfig, { chainId });
  if (!walletClient?.account) {
    throw new Error('Connect MetaMask on Sepolia before sending a transaction.');
  }

  const signerAddress = walletClient.account.address;
  if (
    params.account &&
    params.account.toLowerCase() !== signerAddress.toLowerCase()
  ) {
    throw new Error(
      'MetaMask account mismatch — select the same account in the extension as connected on FAPEX.',
    );
  }

  const { gas } = await withGasLimit({
    ...params,
    account: signerAddress,
  });

  try {
    await simulateContract(wagmiConfig, {
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
      account: signerAddress,
      value: params.value,
      gas,
      chainId,
    });
  } catch (simErr) {
    throw new Error(decodeContractError(simErr, params.abi, params.functionName));
  }

  const strategies: Array<() => Promise<Hash>> = [
    () => writeViaWalletClient(walletClient, params),
    () => writeViaWagmiAction(params, chainId),
    () => writeViaInjectedProvider(signerAddress, params),
  ];

  const strategyNames = ['walletClient.writeContract', 'wagmi.writeContract', 'eth_sendTransaction'];

  let lastErr: unknown;
  for (let i = 0; i < strategies.length; i++) {
    try {
      const hash = await strategies[i]();
      if (import.meta.env.DEV) {
        console.debug(`[contractWrite] signed via ${strategyNames[i]}`, hash);
      }
      return hash;
    } catch (err) {
      if (isUserRejection(err)) {
        throw new Error(decodeContractError(err, params.abi, params.functionName));
      }
      debugWriteFailure(strategyNames[i], err);
      lastErr = err;
    }
  }

  throw new Error(decodeContractError(lastErr, params.abi, params.functionName));
}

export async function executeContractWrite(params: ContractWriteInput): Promise<`0x${string}`> {
  return sendContractTransaction(params);
}
