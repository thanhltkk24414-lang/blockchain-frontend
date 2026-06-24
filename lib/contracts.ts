/**
 * Deployed FAPEX smart contract addresses on Sepolia Testnet.
 * Source: deployments/sepolia.json
 */
export const CHAIN = {
  id: 11155111,
  name: "Sepolia",
  rpc: "https://sepolia.infura.io/v3/YOUR_PROJECT_ID",
  explorer: "https://sepolia.etherscan.io",
} as const

export const CONTRACTS = {
  MockUSDC: "0x2293193Eaa5CE5253d5e081046a06dB077f26f8e",
  ReputationStore: "0x7A96219812e9363dBdbD43BE14384820E5f9b0DC",
  PlatformTreasury: "0x0110BfF85E484b82205833D3950fC7C61714c0e7",
  JobRegistry: "0xeF5cc7a22D7Ff9e7FA0c5Fe714F088c98758A549",
  ArbitratorPanel: "0x324e7d8Cfe5aBdb62caa236Bb23626E23BC7EC4F",
  EscrowVault: "0xf2143d1EA4D5a8716344c2cef862f9ed41244ED5",
} as const

export const PLATFORM_CONFIG = {
  clientFeePercent: 3,
  freelancerFeePercent: 2,
  reviewPeriodDays: 7,
  evidenceWindowHours: 72,
  evidenceExtensionHours: 48,
  appealFeeMultiplier: 1.3,
  minBudgetUSDC: 10,
  maxMilestones: 10,
} as const
