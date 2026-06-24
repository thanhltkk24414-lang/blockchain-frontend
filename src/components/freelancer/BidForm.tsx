import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { submitBid } from '@/lib/api';

interface BidFormProps {
  jobId: string;
  onchainJobId?: number;
  jobTitle: string;
  suggestedBudget?: number;
  onSubmitted?: () => void;
}

export function BidForm({ jobId, onchainJobId, jobTitle, suggestedBudget, onSubmitted }: BidFormProps) {
  const { isAuthenticated, user } = useAuth();
  const [title, setTitle] = useState(`Proposal for ${jobTitle}`.slice(0, 100));
  const [description, setDescription] = useState('');
  const [bidAmount, setBidAmount] = useState(suggestedBudget != null ? String(suggestedBudget) : '');
  const [timeline, setTimeline] = useState('7');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isAuthenticated) {
    return <p className="muted">Sign in with SIWE to submit a bid.</p>;
  }

  if (user?.role !== 'freelancer') {
    return (
      <p className="muted">
        Only freelancers can submit bids. Set your role to <strong>Freelancer</strong> on{' '}
        <a href="/profile">Profile</a>.
      </p>
    );
  }

  const resolvedOnchainJobId =
    onchainJobId != null ? Number(onchainJobId) : undefined;
  const canSubmitBid =
    resolvedOnchainJobId != null &&
    Number.isFinite(resolvedOnchainJobId) &&
    resolvedOnchainJobId > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitBid) {
      setError(
        'This job has no on-chain ID yet. Bids cannot be submitted until the job is registered on-chain.',
      );
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await submitBid({
        jobId,
        onchainJobId: resolvedOnchainJobId,
        title: title.trim(),
        description: description.trim(),
        bidAmount: parseInt(bidAmount, 10),
        timeline: parseInt(timeline, 10),
      });
      if (res.success) {
        setMessage('Bid submitted successfully.');
        onSubmitted?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit bid');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="panel form-panel bid-form" onSubmit={handleSubmit}>
      <h3>Submit proposal</h3>
      <label className="field">
        Proposal title
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} />
      </label>
      <label className="field">
        Cover letter
        <textarea
          className="input textarea"
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          minLength={20}
          placeholder="Explain your approach, relevant experience, and timeline…"
        />
      </label>
      <div className="form-row">
        <label className="field">
          Bid amount (USDC)
          <input
            className="input"
            type="number"
            min={1}
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            required
          />
        </label>
        <label className="field">
          Timeline (days)
          <input
            className="input"
            type="number"
            min={1}
            value={timeline}
            onChange={(e) => setTimeline(e.target.value)}
            required
          />
        </label>
      </div>
      {!canSubmitBid && (
        <p className="error">
          This job has no on-chain ID yet. Bids cannot be submitted until the job is registered
          on-chain.
        </p>
      )}
      <button className="btn primary" type="submit" disabled={loading || !canSubmitBid}>
        {loading ? 'Submitting…' : 'Submit bid'}
      </button>
      {message && <p className="badge success">{message}</p>}
      {error && <p className="error">{error}</p>}
    </form>
  );
}
