import { API_URL } from '@/config/env';
import { getStoredToken } from '@/lib/auth';
import type { Job, JobsResponse, UserProfile } from './types';

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
}): Promise<JobsResponse> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.status) qs.set('status', params.status);
  if (params?.category) qs.set('category', params.category);
  if (params?.search) qs.set('search', params.search);

  const res = await fetch(`${API_URL}/api/jobs?${qs}`);
  return parseJson<JobsResponse>(res);
}

export async function searchJobs(q: string, category?: string) {
  const qs = new URLSearchParams({ q });
  if (category) qs.set('category', category);
  const res = await fetch(`${API_URL}/api/jobs/search?${qs}`);
  return parseJson<{ success: boolean; jobs: Job[] }>(res);
}

export async function fetchJobById(id: string) {
  const res = await fetch(`${API_URL}/api/jobs/${id}`);
  return parseJson<{ success: boolean; job: Job }>(res);
}

export async function fetchJobsByClient(address: string, status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_URL}/api/jobs/client/${address}${qs}`);
  return parseJson<{ success: boolean; jobs: Job[] }>(res);
}

export async function fetchJobsByFreelancer(address: string, status?: string) {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_URL}/api/jobs/freelancer/${address}${qs}`);
  return parseJson<{ success: boolean; jobs: Job[] }>(res);
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
  email?: string;
}) {
  const res = await fetch(`${API_URL}/api/users/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(payload),
  });
  return parseJson<{ success: boolean; user?: UserProfile }>(res);
}

export async function updateUserProfile(payload: Partial<UserProfile['profile']>) {
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

export async function fetchHealth() {
  const res = await fetch(`${API_URL}/health`);
  return parseJson<{
    status: string;
    mongodb: string;
    websocket: { enabled: boolean; path: string };
  }>(res);
}
