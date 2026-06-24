import deployments from './deployments-sepolia.json';

const env = import.meta.env;

export const CHAIN_ID = Number(env.VITE_CHAIN_ID || deployments.chainId || 11155111);

export const CONTRACT_ADDRESSES = {
  MockUSDC: (env.VITE_MOCK_USDC_ADDRESS || deployments.addresses.MockUSDC) as `0x${string}`,
  ReputationStore: (env.VITE_REPUTATION_STORE_ADDRESS || deployments.addresses.ReputationStore) as `0x${string}`,
  PlatformTreasury: (env.VITE_PLATFORM_TREASURY_ADDRESS || deployments.addresses.PlatformTreasury) as `0x${string}`,
  JobRegistry: (env.VITE_JOB_REGISTRY_ADDRESS || deployments.addresses.JobRegistry) as `0x${string}`,
  ArbitratorPanel: (env.VITE_ARBITRATOR_PANEL_ADDRESS || deployments.addresses.ArbitratorPanel) as `0x${string}`,
  EscrowVault: (env.VITE_ESCROW_VAULT_ADDRESS || deployments.addresses.EscrowVault) as `0x${string}`,
} as const;
