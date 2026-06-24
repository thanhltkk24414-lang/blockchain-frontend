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
  OnlyFreelancer: 'Chỉ freelancer được gán mới gọi được hàm này.',
  Unauthorized: 'Ví không có quyền thực hiện giao dịch này.',
  ContractPaused: 'Hợp đồng đang tạm dừng (emergency pause).',
  TransferFailed:
    'Chuyển USDC thất bại — kiểm tra số dư MockUSDC và allowance (cần đủ giá job on-chain + 3% phí).',
  LowReputationTier: 'Reputation tier không đủ để thực hiện thao tác này.',
  JobNotOpen: 'Job không còn OPEN — không thể gán freelancer qua depositEscrow.',
};

export function decodeContractError(err: unknown, _abi?: Abi): string {
  if (err instanceof BaseError) {
    const revert = err.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | null;

    if (revert instanceof ContractFunctionRevertedError) {
      const name = revert.data?.errorName;
      if (name) {
        const hint = REVERT_HINTS[name];
        return hint ? `${name}: ${hint}` : `Contract reverted: ${name}`;
      }
      if (revert.reason) {
        return revert.reason;
      }
    }

    return err.shortMessage || err.message;
  }

  if (err instanceof Error) {
    return err.message;
  }

  return 'Transaction failed';
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
    });
  } catch (simErr) {
    throw new Error(decodeContractError(simErr, params.abi));
  }

  return writeContractAsync({
    address: params.address,
    abi: params.abi,
    functionName: params.functionName,
    args: params.args,
    value: params.value,
    gas,
  } as Parameters<typeof writeContractAsync>[0]);
}
