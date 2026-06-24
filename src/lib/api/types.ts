export interface JobClient {
  walletAddress: string;
  username?: string;
  reputation?: number;
  profile?: { fullName?: string };
}

export interface Job {
  _id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  contractValue?: number;
  onchainJobId?: number;
  createdAt?: string;
  skills?: string[];
  client?: JobClient | string;
  freelancer?: JobClient | string;
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

export interface UserProfile {
  walletAddress: string;
  username?: string;
  profile?: {
    fullName?: string;
    bio?: string;
    skills?: string[];
    hourlyRate?: number;
    location?: string;
    avatar?: string;
    role?: 'client' | 'freelancer' | 'arbitrator';
  };
  reputation?: {
    score?: number;
    tier?: string;
    completedJobs?: number;
  };
  stats?: {
    jobsPosted?: number;
    jobsCompleted?: number;
    totalEarned?: number;
  };
}

export interface ApiError {
  success: false;
  error: string;
}
