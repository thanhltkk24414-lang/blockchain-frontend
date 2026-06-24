export type Role = "client" | "freelancer" | "admin"

export type JobStatus =
  | "OPEN"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "COMPLETED"
  | "DISPUTED"
  | "CANCELLED"

export type MilestoneStatus = "Pending" | "In Progress" | "Submitted" | "Approved" | "Rejected"

export type ProposalStatus = "Pending" | "Accepted" | "Rejected" | "Withdrawn"

export type DisputeStatus = "Pending" | "Under Review" | "Resolved"

export type TxStatus = "idle" | "pending" | "success" | "failed"

export type ReputationBadge = "New" | "Rising" | "Trusted" | "Expert"

export interface UserProfile {
  address: string
  name: string
  avatar: string
  bio: string
  skills: string[]
  reputation: number
  badge: ReputationBadge
  joinedAt: number
  role: Role
  locked?: boolean
  completedJobs: number
  rating: number
  portfolio?: { label: string; url: string }[]
}

export interface Milestone {
  id: string
  title: string
  percent: number
  amountUSDC: number
  deadline: number
  status: MilestoneStatus
  deliverableCid?: string
  rejectionReason?: string
}

export interface Proposal {
  id: string
  jobId: string
  freelancer: UserProfile
  coverLetter: string
  bidAmountUSDC: number
  estimatedDays: number
  status: ProposalStatus
  createdAt: number
}

export interface Job {
  id: string
  title: string
  description: string
  skills: string[]
  budgetUSDC: number
  status: JobStatus
  client: UserProfile
  freelancer?: UserProfile
  milestones: Milestone[]
  proposals: Proposal[]
  specCid: string
  createdAt: number
  deadline: number
  flagged?: boolean
}

export interface Evidence {
  party: "client" | "freelancer"
  cid: string
  label: string
  submittedAt: number
}

export interface Dispute {
  id: string
  jobId: string
  jobTitle: string
  milestoneId: string
  reason: string
  status: DisputeStatus
  priority: "Low" | "Medium" | "High"
  client: UserProfile
  freelancer: UserProfile
  amountUSDC: number
  evidence: Evidence[]
  openedAt: number
  evidenceDeadline: number
  resolution?: { clientPercent: number; freelancerPercent: number; note: string }
}

export interface TxRecord {
  hash: string
  type: string
  amountUSDC?: number
  status: "Success" | "Pending" | "Failed"
  timestamp: number
  from: string
  to: string
}

export interface EventLog {
  id: string
  event: string
  detail: string
  timestamp: number
  txHash: string
}

export interface Arbitrator {
  address: string
  name: string
  reputation: number
  stakeUSDC: number
  casesJudged: number
  correctVoteRate: number
  active: boolean
}
