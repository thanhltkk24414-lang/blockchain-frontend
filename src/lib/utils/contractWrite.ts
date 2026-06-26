import { simulateContract } from 'wagmi/actions';
import {
  BaseError,
  ContractFunctionRevertedError,
  UserRejectedRequestError,
  type Abi,
  type Address,
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
  account: Address;
};

export async function executeContractWrite(
  writeContractAsync: (request: ContractWriteInput & { gas?: bigint }) => Promise<`0x${string}`>,
  params: ContractWriteInput,
): Promise<`0x${string}`> {
  const { gas } = await withGasLimit(params);

  try {
    await simulateContract(wagmiConfig, {
      address: params.address,
      abi: params.abi,
      functionName: params.functionName,
      args: params.args,
      account: params.account,
      value: params.value,
      gas,
      chainId: CHAIN_ID as 11155111,
    });
  } catch (simErr) {
    throw new Error(decodeContractError(simErr, params.abi, params.functionName));
  }

  const request = {
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
    account: params.account,
    value: params.value,
    gas,
  };

  try {
    return await writeContractAsync(request as Parameters<typeof writeContractAsync>[0]);
  } catch (writeErr) {
    throw new Error(decodeContractError(writeErr, params.abi, params.functionName));
  }
}
