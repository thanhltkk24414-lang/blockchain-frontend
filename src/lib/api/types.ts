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
  isDisputed?: boolean;
  contractValue?: number;
  onchainJobId?: number;
  onchainClientAddress?: string;
  onchainFreelancerAddress?: string;
  onchainStatus?: string;
  metadataCID?: string;
  clientAddress?: string;
  freelancerAddress?: string;
  duration?: number;
  deadline?: number;
  totalDeposit?: number;
  platformFee?: number;
  deliverables?: string;
  deliverableCID?: string;
  acceptanceCriteria?: string;
  createdAt?: string;
  skills?: string[];
  client?: JobClient | string;
  freelancer?: JobClient | string;
}

export interface JobMetadata {
  title?: string;
  description?: string;
  category?: string;
  skills?: string[];
  deliverables?: string;
  acceptanceCriteria?: string;
  clientAddress?: string;
  createdAt?: string;
}

export interface CreateJobResponse {
  success: boolean;
  message?: string;
  jobId?: number;
  onchainJobId?: number;
  onchainClientAddress?: string;
  metadataCID?: string;
  job?: Job;
  error?: string;
  code?: string;
  hint?: string;
}

export interface JobDetailResponse {
  success: boolean;
  job: Job;
  metadata?: JobMetadata | null;
  onchain?: {
    onchainStatus?: string;
    onchainStatusCode?: number;
    onchainFreelancerAddress?: string | null;
    onchainClientAddress?: string | null;
    deliverableCID?: string | null;
  } | null;
  error?: string;
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

export type RegistrationRole = 'client' | 'freelancer';

export interface UserProfile {
  walletAddress: string;
  username?: string;
  role?: RegistrationRole | 'admin';
  profile?: {
    fullName?: string;
    bio?: string;
    skills?: string[];
    hourlyRate?: number;
    location?: string;
    avatar?: string;
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

export interface Bid {
  _id: string;
  jobId: string | Pick<Job, '_id' | 'title' | 'status' | 'contractValue' | 'clientAddress'>;
  onchainJobId?: number;
  freelancerAddress: string;
  proposalCID?: string;
  bidAmount: number;
  title?: string;
  description?: string;
  timeline?: number;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: string;
}

export interface BidsResponse {
  success: boolean;
  bids: Bid[];
  count?: number;
  error?: string;
}
