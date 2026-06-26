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
    'Trạng thái job on-chain không hợp lệ. depositEscrow cần job OPEN; nếu đã ASSIGNED (thường do gọi assignFreelancer / Retry assign trước đó), tạo job mới.',
  OnlyClient: 'Chỉ ví client on-chain (người tạo job trên JobRegistry) mới gọi được hàm này.',
  OnlyFreelancer:
    'Chỉ ví freelancer được gán khi nạp escrow mới gọi được hàm này — kiểm tra ví MetaMask.',
  Unauthorized: 'Ví không có quyền thực hiện giao dịch này.',
  ContractPaused: 'Hợp đồng đang tạm dừng (emergency pause).',
  TransferFailed:
    'Chuyển USDC thất bại — kiểm tra số dư MockUSDC và allowance (cần đủ giá job on-chain + 3% phí).',
  LowReputationTier: 'Reputation tier không đủ để thực hiện thao tác này.',
  AccountRestricted:
    'Reputation tier Restricted (điểm < 50) — không được tạo job hoặc thao tác bị chặn.',
  JobNotOpen: 'Job không còn OPEN — không thể gán freelancer qua depositEscrow.',
  StartWindowExpired:
    'Đã quá 72 giờ kể từ khi được gán — client có thể hủy hợp đồng. Liên hệ client.',
};

const REVERT_HINTS_BY_FN: Record<string, Record<string, string>> = {
  createJob: {
    AccountRestricted:
      'Ví client có tier Restricted — không gọi được createJob. Dùng ví khác hoặc nhờ admin cập nhật reputation.',
    InvalidJob: 'Tham số job không hợp lệ — kiểm tra budget USDC (> 0) và duration (giây).',
  },
  submitWork: {
    WrongStatus:
      'Job chưa startWork — đang gọi startWork trước... (submitWork chỉ chạy khi IN_PROGRESS).',
    OnlyFreelancer:
      'Ví MetaMask không trùng freelancer on-chain. Đổi sang ví đã được gán khi client nạp escrow.',
  },
  startWork: {
    WrongStatus: 'startWork chỉ gọi được khi job ASSIGNED (sau depositEscrow).',
    OnlyFreelancer:
      'Ví MetaMask không trùng freelancer on-chain. Đổi sang ví đã được gán khi client nạp escrow.',
    StartWindowExpired:
      'Đã quá 72 giờ kể từ khi được gán — client có thể hủy hợp đồng.',
  },
  approveAndRelease: {
    WrongStatus:
      'approveAndRelease chỉ gọi được khi job SUBMITTED (freelancer đã submitWork on-chain).',
    OnlyClient:
      'Chỉ ví client on-chain (người tạo job) mới phê duyệt — đổi sang ví client đúng trong MetaMask.',
    ContractPaused: 'EscrowVault đang pause — thử lại sau.',
    TransferFailed: 'Chuyển USDC thất bại — escrow có thể chưa khóa đủ tiền cho job này.',
  },
  raiseDispute: {
    WrongStatus:
      'raiseDispute chỉ gọi được khi job SUBMITTED hoặc IN_PROGRESS (chưa COMPLETED).',
    NotAParty: 'Chỉ client hoặc freelancer on-chain mới mở tranh chấp — đổi ví MetaMask.',
    AlreadyDisputed: 'Job đã từng mở tranh chấp — không thể mở lại.',
    LowReputationTier: 'Reputation tier Warning/Restricted không được mở tranh chấp mới.',
    TransferFailed:
      'Chuyển phí tranh chấp USDC thất bại — kiểm tra số dư MockUSDC và allowance cho EscrowVault.',
    NotEnoughArbitrators:
      'Chưa đủ 5 arbitrator trong pool (ArbitratorPanel.poolSize). Admin cần joinPool trước khi demo dispute.',
  },
};

function formatDecodedMessage(msg: string, functionName?: string): string {
  if (/invalid address/i.test(msg)) {
    return (
      'Địa chỉ ví không hợp lệ (cần 0x + đúng 40 ký tự hex). ' +
      'Kiểm tra account trong MetaMask — địa chỉ dài hơn 42 ký tự thường bị copy thừa ký tự.'
    );
  }
  if (/user rejected|user denied|rejected the request/i.test(msg)) {
    return 'Bạn đã từ chối giao dịch trong MetaMask.';
  }
  if (/chain.?mismatch|wrong network|unsupported chain/i.test(msg)) {
    return `MetaMask phải ở Sepolia (chainId ${CHAIN_ID}) trước khi gọi ${functionName ?? 'contract'}.`;
  }
  if (/missing or invalid parameters/i.test(msg)) {
    const clean = msg.replace(/^MetaMask RPC:\s*/i, '').trim();
    return (
      `MetaMask RPC: ${clean}. Thường do nhiều ví inject (Coinbase/Brave/Rabby) hoặc connector sai — ` +
      `không phải lỗi calldata/ABI. Thử Disconnect → Connect lại MetaMask; tắt extension ví khác; ` +
      `refresh trang. createJob dùng wagmi sendTransaction (không eth_sendTransaction thủ công).`
    );
  }
  if (/transaction creation failed/i.test(msg)) {
    return (
      'MetaMask không tạo được giao dịch — kiểm tra extension: đúng account, mạng Sepolia, đủ ETH gas. ' +
      'Thử disconnect/reconnect ví trên Fapex; chỉ import lại private key nếu địa chỉ hiển thị sai định dạng (không phải 0x + 40 hex).'
    );
  }
  if (/connector account not found|account not found/i.test(msg)) {
    return (
      'Account MetaMask không khớp yêu cầu giao dịch — chọn đúng account trong extension (phải trùng ví đã kết nối trên Fapex).'
    );
  }
  if (/reverted.*unknown|out of gas|intrinsic gas too low|missing revert data/i.test(msg)) {
    const gasHint =
      functionName === 'approveAndRelease'
        ? 'approveAndRelease cần ~225k+ gas trên Sepolia.'
        : functionName === 'submitWork'
          ? 'submitWork cần ~180k+ gas.'
          : functionName === 'createJob'
            ? 'createJob cần ~120k+ gas; đảm bảo có Sepolia ETH.'
            : 'gas limit có thể quá thấp.';
    return (
      `Giao dịch bị contract từ chối (revert không decode được). Thường do ${gasHint} ` +
      'Kiểm tra ví MetaMask đúng role và trạng thái job on-chain.'
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
      return 'Bạn đã từ chối giao dịch trong MetaMask.';
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

  return 'Giao dịch thất bại';
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
    throw new Error('MetaMask provider không khả dụng — cài/kích hoạt extension.');
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
      `Địa chỉ contract không hợp lệ (${String(params.address)}). Kiểm tra VITE_JOB_REGISTRY_ADDRESS / deployments-sepolia.json.`,
    );
  }

  const chainId = CHAIN_ID as 11155111;

  const walletClient = await getWalletClient(wagmiConfig, { chainId });
  if (!walletClient?.account) {
    throw new Error('Kết nối ví MetaMask trên Sepolia trước khi gửi giao dịch.');
  }

  const signerAddress = walletClient.account.address;
  if (
    params.account &&
    params.account.toLowerCase() !== signerAddress.toLowerCase()
  ) {
    throw new Error(
      'Account MetaMask không khớp — chọn đúng account trong extension (phải trùng ví đã kết nối trên Fapex).',
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
