import { VOTE_CHOICES } from '@/hooks/useDisputeActions';

export const DISPUTE_CHOICE_LABELS: Record<number, string> = {
  0: 'Chưa quyết định',
  [VOTE_CHOICES.FREELANCER_WIN]: 'Freelancer thắng',
  [VOTE_CHOICES.CLIENT_WIN]: 'Client thắng',
  [VOTE_CHOICES.SPLIT]: 'Chia 50-50',
};

export function formatDisputeChoice(choice: number): string {
  return DISPUTE_CHOICE_LABELS[choice] ?? `Lựa chọn #${choice}`;
}

export type VoteTally = {
  freelancer: number;
  client: number;
  split: number;
  total: number;
};

export function emptyVoteTally(): VoteTally {
  return { freelancer: 0, client: 0, split: 0, total: 0 };
}

export function addVoteToTally(tally: VoteTally, choice: number): VoteTally {
  const next = { ...tally };
  if (choice === VOTE_CHOICES.FREELANCER_WIN) next.freelancer += 1;
  else if (choice === VOTE_CHOICES.CLIENT_WIN) next.client += 1;
  else if (choice === VOTE_CHOICES.SPLIT) next.split += 1;
  if (choice !== 0) next.total += 1;
  return next;
}
