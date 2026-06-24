import JobRegistryAbi from './abis/JobRegistry.json';
import EscrowVaultAbi from './abis/EscrowVault.json';
import MockUSDCAbi from './abis/MockUSDC.json';
import ArbitratorPanelAbi from './abis/ArbitratorPanel.json';
import ReputationStoreAbi from './abis/ReputationStore.json';
import { CONTRACT_ADDRESSES } from './addresses';

export const contracts = {
  jobRegistry: {
    address: CONTRACT_ADDRESSES.JobRegistry,
    abi: JobRegistryAbi as readonly unknown[],
  },
  escrowVault: {
    address: CONTRACT_ADDRESSES.EscrowVault,
    abi: EscrowVaultAbi as readonly unknown[],
  },
  mockUsdc: {
    address: CONTRACT_ADDRESSES.MockUSDC,
    abi: MockUSDCAbi as readonly unknown[],
  },
  arbitratorPanel: {
    address: CONTRACT_ADDRESSES.ArbitratorPanel,
    abi: ArbitratorPanelAbi as readonly unknown[],
  },
  reputationStore: {
    address: CONTRACT_ADDRESSES.ReputationStore,
    abi: ReputationStoreAbi as readonly unknown[],
  },
} as const;

/** Write functions the UI will call (Phase 2+) */
export const CONTRACT_WRITE_ACTIONS = {
  jobRegistry: ['createJob', 'submitProposal', 'assignFreelancer', 'cancelOpenJob'],
  escrowVault: [
    'depositEscrow',
    'approveAndRelease',
    'raiseDispute',
    'startWork',
    'submitWork',
    'releaseFunds',
  ],
  mockUsdc: ['approve', 'transfer', 'mint'],
  arbitratorPanel: ['stake', 'vote', 'finalizeVote'],
} as const;

/** Read functions the UI will call */
export const CONTRACT_READ_ACTIONS = {
  jobRegistry: ['getJob', 'getProposals', 'jobCounter'],
  escrowVault: ['getEscrow', 'isDisputed'],
  mockUsdc: ['balanceOf', 'allowance'],
  arbitratorPanel: ['getStake', 'getDispute'],
  reputationStore: ['getReputation'],
} as const;
