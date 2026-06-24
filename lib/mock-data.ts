import type {
  Arbitrator,
  Dispute,
  EventLog,
  Job,
  Proposal,
  TxRecord,
  UserProfile,
} from "./types"

const DAY = 1000 * 60 * 60 * 24
const now = Date.now()

export const USERS: Record<string, UserProfile> = {
  client1: {
    address: "0x523eBd853a1638065f148A05c0Ca423E490D92f7",
    name: "Aurora Labs",
    avatar: "/avatars/aurora.png",
    bio: "Web3 product studio building consumer dApps. We hire vetted talent for design and smart contract work.",
    skills: ["Product", "DeFi", "NFT"],
    reputation: 720,
    badge: "Trusted",
    joinedAt: now - 220 * DAY,
    role: "client",
    completedJobs: 34,
    rating: 4.8,
  },
  client2: {
    address: "0x9A7c4f2BdE13aB5C8901234567890aBcDeF01234",
    name: "Nimbus DAO",
    avatar: "/avatars/nimbus.png",
    bio: "Community-governed DAO funding open-source infrastructure.",
    skills: ["Governance", "Tooling"],
    reputation: 540,
    badge: "Rising",
    joinedAt: now - 120 * DAY,
    role: "client",
    completedJobs: 12,
    rating: 4.6,
  },
  fl1: {
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    name: "Maya Chen",
    avatar: "/avatars/maya.png",
    bio: "Senior Solidity engineer. 6 years building audited DeFi protocols and ERC standards.",
    skills: ["Solidity", "Foundry", "Security", "DeFi"],
    reputation: 910,
    badge: "Expert",
    joinedAt: now - 400 * DAY,
    role: "freelancer",
    completedJobs: 58,
    rating: 4.9,
    portfolio: [
      { label: "GitHub", url: "https://github.com" },
      { label: "Audit Reports", url: "https://example.com" },
    ],
  },
  fl2: {
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    name: "Leo Martins",
    avatar: "/avatars/leo.png",
    bio: "Full-stack Web3 developer specializing in React, wagmi and subgraph indexing.",
    skills: ["React", "Next.js", "The Graph", "wagmi"],
    reputation: 680,
    badge: "Trusted",
    joinedAt: now - 180 * DAY,
    role: "freelancer",
    completedJobs: 41,
    rating: 4.7,
    portfolio: [{ label: "Portfolio", url: "https://example.com" }],
  },
  fl3: {
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    name: "Sofia Reyes",
    avatar: "/avatars/sofia.png",
    bio: "Product designer focused on Web3 UX, design systems and motion.",
    skills: ["UI/UX", "Figma", "Design Systems", "Motion"],
    reputation: 340,
    badge: "Rising",
    joinedAt: now - 70 * DAY,
    role: "freelancer",
    completedJobs: 9,
    rating: 4.5,
  },
  fl4: {
    address: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65",
    name: "Dev Kapoor",
    avatar: "/avatars/dev.png",
    bio: "New to FAPEX. Backend engineer pivoting into Web3 infrastructure.",
    skills: ["Node.js", "Rust", "Postgres"],
    reputation: 120,
    badge: "New",
    joinedAt: now - 12 * DAY,
    role: "freelancer",
    completedJobs: 1,
    rating: 4.2,
  },
}

function proposal(
  id: string,
  jobId: string,
  fl: UserProfile,
  bid: number,
  days: number,
  status: Proposal["status"],
  letter: string,
): Proposal {
  return {
    id,
    jobId,
    freelancer: fl,
    coverLetter: letter,
    bidAmountUSDC: bid,
    estimatedDays: days,
    status,
    createdAt: now - 3 * DAY,
  }
}

export const JOBS: Job[] = [
  {
    id: "JOB-1001",
    title: "Build an ERC-4626 yield vault with audit-ready tests",
    description:
      "We need a production-grade ERC-4626 tokenized vault integrating with Aave v3. Must include deposit/withdraw flows, fee accrual, and a complete Foundry test suite targeting 95%+ coverage. Deliverables include NatSpec docs and a deployment script for Sepolia.",
    skills: ["Solidity", "Foundry", "DeFi", "Security"],
    budgetUSDC: 8000,
    status: "IN_PROGRESS",
    client: USERS.client1,
    freelancer: USERS.fl1,
    specCid: "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
    createdAt: now - 18 * DAY,
    deadline: now + 22 * DAY,
    milestones: [
      { id: "M1", title: "Architecture & interfaces", percent: 20, amountUSDC: 1600, deadline: now - 6 * DAY, status: "Approved" },
      { id: "M2", title: "Core vault implementation", percent: 40, amountUSDC: 3200, deadline: now + 2 * DAY, status: "Submitted", deliverableCid: "bafkre1coreimpl9x" },
      { id: "M3", title: "Test suite & coverage", percent: 25, amountUSDC: 2000, deadline: now + 12 * DAY, status: "In Progress" },
      { id: "M4", title: "Docs & deployment", percent: 15, amountUSDC: 1200, deadline: now + 22 * DAY, status: "Pending" },
    ],
    proposals: [
      proposal("P1", "JOB-1001", USERS.fl1, 8000, 30, "Accepted", "I have audited 4 similar vaults. Can start immediately."),
      proposal("P2", "JOB-1001", USERS.fl4, 7200, 35, "Rejected", "Eager to prove myself on a real DeFi build."),
    ],
  },
  {
    id: "JOB-1002",
    title: "Design system & landing page for a DEX aggregator",
    description:
      "Looking for a product designer to craft a cohesive design system (Figma) and a high-converting landing page for our DEX aggregator. Dark-first aesthetic, motion guidelines, and handoff-ready components.",
    skills: ["UI/UX", "Figma", "Design Systems"],
    budgetUSDC: 4500,
    status: "ASSIGNED",
    client: USERS.client1,
    freelancer: USERS.fl3,
    specCid: "bafybeih3designspecabc1234567890qwerty",
    createdAt: now - 5 * DAY,
    deadline: now + 25 * DAY,
    milestones: [
      { id: "M1", title: "Discovery & moodboard", percent: 25, amountUSDC: 1125, deadline: now + 5 * DAY, status: "Pending" },
      { id: "M2", title: "Design system", percent: 45, amountUSDC: 2025, deadline: now + 15 * DAY, status: "Pending" },
      { id: "M3", title: "Landing page", percent: 30, amountUSDC: 1350, deadline: now + 25 * DAY, status: "Pending" },
    ],
    proposals: [
      proposal("P3", "JOB-1002", USERS.fl3, 4500, 25, "Accepted", "Web3 design is my specialty — see my recent DEX work."),
    ],
  },
  {
    id: "JOB-1003",
    title: "Subgraph + indexer for an NFT marketplace",
    description:
      "Build a subgraph indexing mints, listings, sales and bids for our marketplace contracts. Provide a typed GraphQL schema and a small dashboard query layer.",
    skills: ["The Graph", "TypeScript", "GraphQL"],
    budgetUSDC: 3200,
    status: "OPEN",
    client: USERS.client2,
    specCid: "bafybeisubgraphspec0987654321",
    createdAt: now - 2 * DAY,
    deadline: now + 30 * DAY,
    milestones: [
      { id: "M1", title: "Schema & mappings", percent: 50, amountUSDC: 1600, deadline: now + 14 * DAY, status: "Pending" },
      { id: "M2", title: "Query layer & docs", percent: 50, amountUSDC: 1600, deadline: now + 30 * DAY, status: "Pending" },
    ],
    proposals: [
      proposal("P4", "JOB-1003", USERS.fl2, 3000, 20, "Pending", "I've shipped 10+ subgraphs. Can optimize for fast queries."),
      proposal("P5", "JOB-1003", USERS.fl4, 2800, 28, "Pending", "Strong backend background, ready to learn The Graph deeply."),
    ],
  },
  {
    id: "JOB-1004",
    title: "Frontend for a DAO governance portal (wagmi + Next.js)",
    description:
      "Implement a governance portal: proposal list, voting UI, delegation, and on-chain tx states. Must use wagmi v2 and follow our existing design tokens.",
    skills: ["React", "Next.js", "wagmi", "TypeScript"],
    budgetUSDC: 5600,
    status: "OPEN",
    client: USERS.client2,
    specCid: "bafybeidaoportalspecasdfghjkl",
    createdAt: now - 1 * DAY,
    deadline: now + 35 * DAY,
    milestones: [
      { id: "M1", title: "Proposal browsing", percent: 30, amountUSDC: 1680, deadline: now + 12 * DAY, status: "Pending" },
      { id: "M2", title: "Voting & delegation", percent: 40, amountUSDC: 2240, deadline: now + 24 * DAY, status: "Pending" },
      { id: "M3", title: "Tx states & polish", percent: 30, amountUSDC: 1680, deadline: now + 35 * DAY, status: "Pending" },
    ],
    proposals: [
      proposal("P6", "JOB-1004", USERS.fl2, 5600, 30, "Pending", "This is exactly my stack. Portfolio attached."),
    ],
  },
  {
    id: "JOB-1005",
    title: "Security review of staking contracts",
    description:
      "Independent security review of our staking and rewards contracts. Provide a findings report with severity ratings and remediation guidance.",
    skills: ["Security", "Solidity", "Audit"],
    budgetUSDC: 12000,
    status: "DISPUTED",
    client: USERS.client1,
    freelancer: USERS.fl1,
    specCid: "bafybeisecurityreviewspeczxcvbnm",
    createdAt: now - 30 * DAY,
    deadline: now + 5 * DAY,
    milestones: [
      { id: "M1", title: "Initial review", percent: 50, amountUSDC: 6000, deadline: now - 10 * DAY, status: "Approved" },
      { id: "M2", title: "Final report", percent: 50, amountUSDC: 6000, deadline: now - 2 * DAY, status: "Rejected", rejectionReason: "Report missing 2 agreed-upon contract modules." },
    ],
    proposals: [proposal("P7", "JOB-1005", USERS.fl1, 12000, 28, "Accepted", "Comprehensive review with manual + fuzzing.")],
  },
  {
    id: "JOB-1006",
    title: "Smart contract migration to L2 (Base)",
    description:
      "Migrate and adapt our protocol contracts to Base, including bridge integration and gas optimization. Completed and rated.",
    skills: ["Solidity", "L2", "Optimization"],
    budgetUSDC: 9000,
    status: "COMPLETED",
    client: USERS.client1,
    freelancer: USERS.fl1,
    specCid: "bafybeil2migrationspec123",
    createdAt: now - 90 * DAY,
    deadline: now - 30 * DAY,
    milestones: [
      { id: "M1", title: "Migration plan", percent: 20, amountUSDC: 1800, deadline: now - 75 * DAY, status: "Approved" },
      { id: "M2", title: "Contract adaptation", percent: 50, amountUSDC: 4500, deadline: now - 50 * DAY, status: "Approved" },
      { id: "M3", title: "Bridge & tests", percent: 30, amountUSDC: 2700, deadline: now - 30 * DAY, status: "Approved" },
    ],
    proposals: [proposal("P8", "JOB-1006", USERS.fl1, 9000, 45, "Accepted", "Done several L2 migrations.")],
  },
]

export const DISPUTES: Dispute[] = [
  {
    id: "DSP-501",
    jobId: "JOB-1005",
    jobTitle: "Security review of staking contracts",
    milestoneId: "M2",
    reason: "Client rejected the final report claiming missing modules; freelancer asserts those were out of original scope.",
    status: "Under Review",
    priority: "High",
    client: USERS.client1,
    freelancer: USERS.fl1,
    amountUSDC: 6000,
    openedAt: now - 2 * DAY,
    evidenceDeadline: now + 1 * DAY,
    evidence: [
      { party: "client", cid: "bafkreiclientevidence1", label: "Original scope document.pdf", submittedAt: now - 1 * DAY },
      { party: "freelancer", cid: "bafkreiflevidence1", label: "Delivered report + chat log.zip", submittedAt: now - 1 * DAY },
    ],
  },
  {
    id: "DSP-502",
    jobId: "JOB-1002",
    jobTitle: "Design system & landing page for a DEX aggregator",
    milestoneId: "M1",
    reason: "Disagreement on revision count for the discovery milestone.",
    status: "Pending",
    priority: "Medium",
    client: USERS.client1,
    freelancer: USERS.fl3,
    amountUSDC: 1125,
    openedAt: now - 6 * 60 * 60 * 1000,
    evidenceDeadline: now + 2.5 * DAY,
    evidence: [],
  },
]

export const ARBITRATORS: Arbitrator[] = [
  { address: "0xA0Ee7A142d267C1f36714E4a8F75612F20a79720", name: "Arbiter One", reputation: 880, stakeUSDC: 25000, casesJudged: 142, correctVoteRate: 96, active: true },
  { address: "0xBcd4042DE499D14e55001CcbB24a551F3b954096", name: "Justice DAO", reputation: 810, stakeUSDC: 18000, casesJudged: 98, correctVoteRate: 92, active: true },
  { address: "0x71bE63f3384f5fb98995898A86B02Fb2426c5788", name: "Neutral Node", reputation: 640, stakeUSDC: 12000, casesJudged: 51, correctVoteRate: 88, active: true },
  { address: "0xFABB0ac9d68B0B445fB7357272Ff202C5651694a", name: "Rogue Arbiter", reputation: 210, stakeUSDC: 8000, casesJudged: 30, correctVoteRate: 61, active: false },
]

export const TRANSACTIONS: TxRecord[] = [
  { hash: "0xa1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90", type: "Escrow Deposit", amountUSDC: 8240, status: "Success", timestamp: now - 18 * DAY, from: USERS.client1.address, to: "EscrowVault" },
  { hash: "0xb2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1", type: "Milestone Release", amountUSDC: 1600, status: "Success", timestamp: now - 6 * DAY, from: "EscrowVault", to: USERS.fl1.address },
  { hash: "0xc3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2", type: "Deliverable Submitted", status: "Success", timestamp: now - 1 * DAY, from: USERS.fl1.address, to: "JobRegistry" },
  { hash: "0xd4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3", type: "Dispute Raised", amountUSDC: 6000, status: "Pending", timestamp: now - 2 * DAY, from: USERS.client1.address, to: "DisputeArbitration" },
]

export const EVENT_LOGS: EventLog[] = [
  { id: "E1", event: "DisputeRaised", detail: "JOB-1005 milestone M2 — 6,000 USDC at stake", timestamp: now - 2 * DAY, txHash: "0xd4e5f6..." },
  { id: "E2", event: "WorkSubmitted", detail: "JOB-1001 milestone M2 deliverable submitted", timestamp: now - 1 * DAY, txHash: "0xc3d4e5..." },
  { id: "E3", event: "JobCreated", detail: "JOB-1004 created by Nimbus DAO — 5,600 USDC", timestamp: now - 1 * DAY, txHash: "0xe5f607..." },
  { id: "E4", event: "EscrowDeposited", detail: "JOB-1002 escrow funded — 4,635 USDC", timestamp: now - 5 * DAY, txHash: "0xf60718..." },
  { id: "E5", event: "MilestoneApproved", detail: "JOB-1001 milestone M1 approved — 1,600 USDC released", timestamp: now - 6 * DAY, txHash: "0xb2c3d4..." },
]

export const INCOME_BY_MONTH = [
  { month: "Jan", usdc: 4200 },
  { month: "Feb", usdc: 6100 },
  { month: "Mar", usdc: 3800 },
  { month: "Apr", usdc: 7400 },
  { month: "May", usdc: 5200 },
  { month: "Jun", usdc: 8900 },
]

export const VOLUME_BY_DAY = [
  { day: "Mon", volume: 12400 },
  { day: "Tue", volume: 18900 },
  { day: "Wed", volume: 9800 },
  { day: "Thu", volume: 24500 },
  { day: "Fri", volume: 31200 },
  { day: "Sat", volume: 14600 },
  { day: "Sun", volume: 8200 },
]

/** Default connected demo wallet (acts as all roles via role switcher) */
export const DEMO_WALLET = {
  address: "0x523eBd853a1638065f148A05c0Ca423E490D92f7",
  ethBalance: 2.4815,
  usdcBalance: 18450,
}
