import { API_URL } from '@/config/env';
import { getStoredToken } from '@/lib/auth';
import type {
  BidsResponse,
  Bid,
  CreateJobResponse,
  Job,
  JobDetailResponse,
  JobsResponse,
  UserProfile,
  RegistrationRole,
} from './types';
import type { CreateJobPayload } from '@/lib/validation/jobForm';
import { normalizeBids, normalizeJob, normalizeJobs } from './normalize';
import { parseApiDate } from '@/lib/utils/dates';

function authHeaders(): HeadersInit {
  const token = getStoredToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || res.statusText);
  }
  return data;
}

export async function fetchJobs(params?: {
  page?: number;
  limit?: number;
  status?: string;
  category?: string;
  search?: string;
  sortBy?: string;
  order?: string;
}): Promise<JobsResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  if (params?.category) qs.set('category', params.category);
  if (params?.search) qs.set('search', params.search);
  if (params?.sortBy) qs.set('sortBy', params.sortBy);
  if (params?.order) qs.set('order', params.order);

  const res = await fetch(`${API_URL}/api/jobs?${qs}`);
  const data = await parseJson<JobsResponse>(res);
  if (data.success && data.jobs) {
    data.jobs = normalizeJobs(data.jobs);
  }
  return data;
}

export async function searchJobs(params: {
  q?: string;
  category?: string;
  minBudget?: number;
  maxBudget?: number;
  status?: string;
}) {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.category) qs.set('category', params.category);
  if (params.minBudget != null) qs.set('minBudget', String(params.minBudget));
  if (params.maxBudget != null) qs.set('maxBudget', String(params.maxBudget));
  if (params.status) qs.set('status', params.status);
  const res = await fetch(`${API_URL}/api/jobs/search?${qs}`);
  const data = await parseJson<{ success: boolean; jobs: Job[]; error?: string }>(res);
  if (data.success && data.jobs) {
    data.jobs = normalizeJobs(data.jobs);
  }
  return data;
}

export async function submitBid(payload: {
  jobId: string;
  onchainJobId: number;
  bidAmount: number;
  title: string;
  description: string;
  timeline: number;
  proposalCID?: string;
}) {
  const res = await fetch(`${API_URL}/api/bids`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean; bid?: Bid; message?: string }>(res);
}

export async function fetchBidsByJob(jobId: string) {
  const res = await fetch(`${API_URL}/api/bids/job/${jobId}`);
  const data = await parseJson<BidsResponse>(res);
  if (data.success && data.bids) {
    data.bids = normalizeBids(data.bids);
  }
  return data;
}

export async function fetchMyBids(address: string, status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_URL}/api/bids/my/${address}${qs}`);
  const data = await parseJson<BidsResponse>(res);
  if (data.success && data.bids) {
    data.bids = normalizeBids(data.bids);
  }
  return data;
}

export async function acceptBid(bidId: string) {
  const res = await fetch(`${API_URL}/api/bids/${bidId}/accept`, {
    method: 'PATCH',
    headers: { ...authHeaders() },
  });
  return parseJson<{
    success: boolean;
    bid?: Bid;
    message?: string;
    assignTxHash?: string;
    onchainJobId?: number;
    code?: string;
    hint?: string;
    error?: string;
  }>(res);
}

export async function retryAssignFreelancer(jobId: string, freelancerAddress: string) {
  const res = await fetch(`${API_URL}/api/jobs/${jobId}/assign-freelancer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ freelancerAddress }),
  });
  return parseJson<{
    success: boolean;
    message?: string;
    assignTxHash?: string;
    error?: string;
    code?: string;
  }>(res);
}

export async function rejectBid(bidId: string) {
  const res = await fetch(`${API_URL}/api/bids/${bidId}/reject`, {
    method: 'PATCH',
    headers: { ...authHeaders() },
  });
  return parseJson<{ success: boolean; bid?: Bid; message?: string }>(res);
}

export async function uploadIpfsMetadata(payload: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/ipfs/upload/metadata`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean; cid: string }>(res);
}

export async function uploadIpfsFile(file: File) {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}/api/ipfs/upload/file`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: form,
  });
  return parseJson<{ success: boolean; cid: string }>(res);
}

export async function fetchJobById(id: string) {
  const res = await fetch(`${API_URL}/api/jobs/${id}`);
  const data = await parseJson<JobDetailResponse>(res);
  if (data.success && data.job) {
    data.job = normalizeJob(data.job);
    if (data.onchain) {
      if (data.onchain.onchainStatus) data.job.onchainStatus = data.onchain.onchainStatus;
      if (data.onchain.onchainFreelancerAddress) {
        data.job.onchainFreelancerAddress = data.onchain.onchainFreelancerAddress;
      }
      if (data.onchain.onchainClientAddress) {
        data.job.onchainClientAddress = data.onchain.onchainClientAddress;
      }
    }
    if (data.metadata) {
      data.metadata = {
        ...data.metadata,
        createdAt: parseApiDate(data.metadata.createdAt),
      };
    }
  }
  return data;
}

export async function createJob(payload: CreateJobPayload) {
  const res = await fetch(`${API_URL}/api/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return parseJson<CreateJobResponse>(res);
}

export async function fetchJobsByClient(address: string, status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_URL}/api/jobs/client/${address}${qs}`);
  const data = await parseJson<{ success: boolean; jobs: Job[]; error?: string }>(res);
  if (data.success && data.jobs) {
    data.jobs = normalizeJobs(data.jobs);
  }
  return data;
}

export async function fetchJobsByFreelancer(address: string, status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_URL}/api/jobs/freelancer/${address}${qs}`);
  const data = await parseJson<{ success: boolean; jobs: Job[]; error?: string }>(res);
  if (data.success && data.jobs) {
    data.jobs = normalizeJobs(data.jobs);
  }
  return data;
}

export async function fetchUserProfile(address: string) {
  const res = await fetch(`${API_URL}/api/users/profile/${address}`);
  return parseJson<{ success: boolean; user: UserProfile }>(res);
}

export async function checkUserExists(address: string) {
  const res = await fetch(`${API_URL}/api/users/check/${address}`);
  return parseJson<{ success: boolean; exists: boolean; user?: UserProfile }>(res);
}

export async function registerUser(payload: {
  walletAddress: string;
  username: string;
  role: RegistrationRole;
  email?: string;
}) {
  const res = await fetch(`${API_URL}/api/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean; user?: UserProfile }>(res);
}

export async function updateUserProfile(
  payload: Partial<UserProfile['profile']> & { role?: UserProfile['role'] },
) {
  const res = await fetch(`${API_URL}/api/users/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean; user?: UserProfile }>(res);
}

export async function fetchUserReputation(address: string) {
  const res = await fetch(`${API_URL}/api/users/reputation/${address}`);
  return parseJson<{ success: boolean; reputation: UserProfile['reputation'] }>(res);
}

export async function fetchUserStats(address: string) {
  const res = await fetch(`${API_URL}/api/users/stats/${address}`);
  return parseJson<{ success: boolean; stats: UserProfile['stats'] }>(res);
}

export async function fetchArbitratorStatus(address: string) {
  const res = await fetch(`${API_URL}/api/arbitrator/${address}/status`);
  return parseJson<{
    success: boolean;
    address?: string;
    stakedAmount?: number;
    minStake?: number;
    isValid?: boolean;
    message?: string;
  }>(res);
}

export interface DisputeRecord {
  _id: string;
  jobId: string;
  onchainJobId: number;
  initiatorAddress?: string;
  respondentAddress?: string;
  status?: string;
  result?: string;
  isResolved?: boolean;
  evidence?: Array<{ submitter: string; ipfsHash: string; submittedAt?: string }>;
  arbitrators?: Array<{ address: string; vote: string; isRevealed: boolean }>;
  openedAt?: string;
}

export async function fetchDisputes(params?: { status?: string; page?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  const res = await fetch(`${API_URL}/api/disputes?${qs}`);
  return parseJson<{
    success: boolean;
    disputes: DisputeRecord[];
    pagination?: { page: number; limit: number; total: number; pages: number };
  }>(res);
}

export async function fetchDisputeByJob(jobId: string) {
  const res = await fetch(`${API_URL}/api/disputes/job/${jobId}`);
  return parseJson<{ success: boolean; dispute?: DisputeRecord; error?: string }>(res);
}

export async function fetchDisputeByOnchainJob(onchainJobId: number) {
  const res = await fetch(`${API_URL}/api/disputes/onchain/${onchainJobId}`);
  return parseJson<{ success: boolean; dispute?: DisputeRecord; error?: string }>(res);
}

export async function fetchDisputeEvidencesByOnchainJob(onchainJobId: number) {
  const res = await fetch(`${API_URL}/api/disputes/onchain/${onchainJobId}/evidences`);
  return parseJson<{
    success: boolean;
    disputeId?: string;
    evidence?: Array<{
      submitter: string;
      ipfsHash?: string;
      onChainHash?: string;
      description?: string;
      submittedAt?: string;
      content?: {
        description?: string;
        evidenceUrl?: string;
        imageCid?: string;
        submitter?: string;
        type?: string;
      } | null;
    }>;
    error?: string;
  }>(res);
}

export async function fetchDisputeEvidences(disputeId: string) {
  const res = await fetch(`${API_URL}/api/disputes/${disputeId}/evidences`);
  return parseJson<{
    success: boolean;
    evidence?: Array<{
      submitter: string;
      ipfsHash: string;
      description?: string;
      submittedAt?: string;
      content?: {
        description?: string;
        evidenceUrl?: string;
        imageCid?: string;
        submitter?: string;
        type?: string;
      } | null;
    }>;
    error?: string;
  }>(res);
}

export async function submitDisputeEvidence(
  disputeId: string,
  payload: { ipfsHash: string; description?: string; onChainHash?: string },
) {
  const res = await fetch(`${API_URL}/api/disputes/${disputeId}/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean; message?: string; evidence?: DisputeRecord['evidence'] }>(
    res,
  );
}

export async function submitDisputeEvidenceByOnchain(
  onchainJobId: number,
  payload: { ipfsHash: string; description?: string; onChainHash?: string },
) {
  const res = await fetch(`${API_URL}/api/disputes/onchain/${onchainJobId}/evidence`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return parseJson<{
    success: boolean;
    message?: string;
    disputeId?: string;
    evidence?: DisputeRecord['evidence'];
  }>(res);
}

export async function fetchHealth() {
  const res = await fetch(`${API_URL}/health`);
  return parseJson<{
    status: string;
    mongodb: string;
    chainId?: number;
    contracts?: Record<string, string | null>;
    websocket: { enabled: boolean; path: string };
  }>(res);
}
