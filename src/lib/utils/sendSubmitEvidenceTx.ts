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

export type SendSubmitEvidenceTxParams = {
  onchainJobId: bigint;
  evidenceHash: `0x${string}`;
  /** Optional wagmi connected address — must match connector account when set. */
  account?: Address;
};

function arbitratorPanelAddress(): Address {
  return getAddress(contracts.arbitratorPanel.address);
}

/**
 * submitEvidence — preflight via public RPC simulateContract; sign via wagmi sendTransaction only.
 * No custom eth_sendTransaction, no manual walletClient, no injected-provider fallbacks.
 */
export async function sendSubmitEvidenceTx({
  onchainJobId,
  evidenceHash,
  account: connectedHint,
}: SendSubmitEvidenceTxParams): Promise<`0x${string}`> {
  const chainId = CHAIN_ID as 11155111;
  const to = arbitratorPanelAddress();
  const args = [onchainJobId, evidenceHash] as const;

  const { address, status, chainId: connectedChainId } = getAccount(wagmiConfig);
  if (status !== 'connected' || !address) {
    throw new Error('Connect your MetaMask wallet on Sepolia before submitting evidence.');
  }

  const signingAccount = getAddress(address);

  if (
    connectedHint &&
    signingAccount.toLowerCase() !== connectedHint.toLowerCase() &&
    import.meta.env.DEV
  ) {
    console.warn('[submitEvidence] wagmi account hint mismatch', {
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
    abi: contracts.arbitratorPanel.abi as Abi,
    functionName: 'submitEvidence',
    args: [...args],
  });

  try {
    await simulateContract(wagmiConfig, {
      address: to,
      abi: contracts.arbitratorPanel.abi as Abi,
      functionName: 'submitEvidence',
      args: [...args],
      account: signingAccount,
      chainId,
    });
  } catch (simErr) {
    logContractError('submitEvidence simulateContract', simErr);
    throw new Error(
      decodeContractError(simErr, contracts.arbitratorPanel.abi as Abi, 'submitEvidence'),
    );
  }

  if (import.meta.env.DEV) {
    console.debug('[submitEvidence] preflight OK', {
      signingAccount,
      chainId,
      arbitratorPanel: to,
      onchainJobId: onchainJobId.toString(),
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
      console.debug('[submitEvidence] sendTransaction OK', hash);
    }
    return hash;
  } catch (err) {
    logContractError('submitEvidence sendTransaction', err);
    throw new Error(
      decodeContractError(err, contracts.arbitratorPanel.abi as Abi, 'submitEvidence'),
    );
  }
}
