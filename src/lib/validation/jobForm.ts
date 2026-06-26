export const JOB_CATEGORIES = [
  { value: 'development', label: 'Development' },
  { value: 'design', label: 'Design' },
  { value: 'writing', label: 'Writing & Content' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'other', label: 'Other' },
] as const;

export interface CreateJobFormValues {
  title: string;
  description: string;
  category: string;
  skills: string;
  contractValue: string;
  durationDays: string;
  deliverables: string;
  acceptanceCriteria: string;
}

export interface CreateJobFormPayload {
  title: string;
  description: string;
  category: string;
  contractValue: number;
  duration: number;
  skills?: string[];
  deliverables: string;
  acceptanceCriteria: string;
}

export interface CreateJobPayload extends CreateJobFormPayload {
  /** Sequential id from JobRegistry after client-signed createJob (omit when relay demo mode). */
  onchainJobId?: number;
  metadataCID: string;
  createTxHash?: string;
  /** Backend INDEXER relay — requires RELAY_CREATE_JOB=true on API. */
  relayCreateJob?: boolean;
}

export function parseSkillsInput(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function validateCreateJobForm(values: CreateJobFormValues): Record<string, string> {
  const errors: Record<string, string> = {};

  const title = values.title.trim();
  if (!title) errors.title = 'Title is required';
  else if (title.length < 5) errors.title = 'Title must be at least 5 characters';
  else if (title.length > 100) errors.title = 'Title must be at most 100 characters';

  const description = values.description.trim();
  if (!description) errors.description = 'Description is required';
  else if (description.length < 20) errors.description = 'Description must be at least 20 characters';

  if (!values.category.trim()) errors.category = 'Category is required';

  const contractValue = Number(values.contractValue);
  if (!values.contractValue.trim()) errors.contractValue = 'Budget is required';
  else if (!Number.isInteger(contractValue) || contractValue < 1) {
    errors.contractValue = 'Budget must be a whole number of USDC (min 1)';
  }

  const durationDays = Number(values.durationDays);
  const durationSeconds = Math.round(durationDays * 86400);
  if (!values.durationDays.trim()) errors.durationDays = 'Duration is required';
  else if (!Number.isFinite(durationDays) || durationDays <= 0) {
    errors.durationDays = 'Duration must be a positive number of days';
  } else if (durationSeconds < 3600) {
    errors.durationDays = 'Duration must be at least 1 hour (use 1 day minimum)';
  }

  if (!values.deliverables.trim()) errors.deliverables = 'Deliverables are required';
  if (!values.acceptanceCriteria.trim()) errors.acceptanceCriteria = 'Acceptance criteria are required';

  return errors;
}

export function formValuesToPayload(values: CreateJobFormValues): CreateJobFormPayload {
  const durationSeconds = Math.max(3600, Math.round(Number(values.durationDays) * 86400));
  const skills = parseSkillsInput(values.skills);

  return {
    title: values.title.trim(),
    description: values.description.trim(),
    category: values.category.trim(),
    contractValue: Number(values.contractValue),
    duration: durationSeconds,
    skills: skills.length > 0 ? skills : undefined,
    deliverables: values.deliverables.trim(),
    acceptanceCriteria: values.acceptanceCriteria.trim(),
  };
}

export const EMPTY_CREATE_JOB_FORM: CreateJobFormValues = {
  title: '',
  description: '',
  category: 'development',
  skills: '',
  contractValue: '',
  durationDays: '7',
  deliverables: '',
  acceptanceCriteria: '',
};
