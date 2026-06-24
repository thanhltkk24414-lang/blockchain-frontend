import { Badge } from "@/components/ui/badge"
import type { DisputeStatus, JobStatus, MilestoneStatus, ProposalStatus } from "@/lib/types"

type Variant = "default" | "secondary" | "success" | "warning" | "danger" | "muted"

const JOB_MAP: Record<JobStatus, Variant> = {
  OPEN: "default",
  ASSIGNED: "secondary",
  IN_PROGRESS: "warning",
  SUBMITTED: "default",
  COMPLETED: "success",
  DISPUTED: "danger",
  CANCELLED: "muted",
}

const MILESTONE_MAP: Record<MilestoneStatus, Variant> = {
  Pending: "muted",
  "In Progress": "warning",
  Submitted: "default",
  Approved: "success",
  Rejected: "danger",
}

const PROPOSAL_MAP: Record<ProposalStatus, Variant> = {
  Pending: "warning",
  Accepted: "success",
  Rejected: "danger",
  Withdrawn: "muted",
}

const DISPUTE_MAP: Record<DisputeStatus, Variant> = {
  Pending: "warning",
  "Under Review": "default",
  Resolved: "success",
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return <Badge variant={JOB_MAP[status]}>{status.replace("_", " ")}</Badge>
}

export function MilestoneStatusBadge({ status }: { status: MilestoneStatus }) {
  return <Badge variant={MILESTONE_MAP[status]}>{status}</Badge>
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Badge variant={PROPOSAL_MAP[status]}>{status}</Badge>
}

export function DisputeStatusBadge({ status }: { status: DisputeStatus }) {
  return <Badge variant={DISPUTE_MAP[status]}>{status}</Badge>
}

const BADGE_VARIANT: Record<string, Variant> = {
  New: "muted",
  Rising: "default",
  Trusted: "success",
  Expert: "warning",
}

export function ReputationBadge({ badge }: { badge: string }) {
  return <Badge variant={BADGE_VARIANT[badge] ?? "muted"}>{badge}</Badge>
}
