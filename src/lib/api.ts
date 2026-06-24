import { API_URL } from '../config/env';

export interface Job {
  _id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  contractValue?: number;
  onchainJobId?: number;
  createdAt?: string;
  client?: {
    walletAddress: string;
    username?: string;
    reputation?: number;
  };
}

export interface JobsResponse {
  success: boolean;
  jobs: Job[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  error?: string;
}

export async function fetchJobs(page = 1, limit = 20): Promise<JobsResponse> {
  const res = await fetch(`${API_URL}/api/jobs?page=${page}&limit=${limit}`);
  return res.json();
}
