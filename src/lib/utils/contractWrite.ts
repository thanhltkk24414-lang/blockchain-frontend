import { simulateContract } from 'wagmi/actions';
import {
  BaseError,
  ContractFunctionRevertedError,
  type Abi,
  type Address,
} from 'viem';
import { wagmiConfig } from '@/config/wagmi';
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
  JobNotOpen: 'Job không còn OPEN — không thể gán freelancer qua depositEscrow.',
  StartWindowExpired:
    'Đã quá 72 giờ kể từ khi được gán — client có thể hủy hợp đồng. Liên hệ client.',
};

const REVERT_HINTS_BY_FN: Record<string, Record<string, string>> = {
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
};

export function decodeContractError(
  err: unknown,
  _abi?: Abi,
  functionName?: string,
): string {
  if (err instanceof BaseError) {
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
    if (/reverted.*unknown|out of gas|intrinsic gas too low/i.test(msg)) {
      return (
        'Giao dịch bị contract từ chối (revert không decode được). ' +
        'Thường do gas limit quá thấp (submitWork cần ~180k+), ví MetaMask không trùng freelancer on-chain, ' +
        'hoặc trạng thái job chưa IN_PROGRESS.'
      );
    }
    return msg;
  }

  if (err instanceof Error) {
    const msg = err.message;
    if (/reverted.*unknown|out of gas|intrinsic gas too low/i.test(msg)) {
      return (
        'Giao dịch bị contract từ chối (revert không decode được). ' +
        'Thường do gas limit quá thấp (submitWork cần ~180k+), ví MetaMask không trùng freelancer on-chain, ' +
        'hoặc trạng thái job chưa IN_PROGRESS.'
      );
    }
    return msg;
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

  return writeContractAsync(request as Parameters<typeof writeContractAsync>[0]);
}
