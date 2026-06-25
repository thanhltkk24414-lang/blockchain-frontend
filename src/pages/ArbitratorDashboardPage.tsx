import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { fetchArbitratorStatus, fetchDisputes } from '@/lib/api';
import { useArbitratorAccess } from '@/hooks/useArbitratorAccess';
import {
  isAssignedArbitrator,
  readChosenArbitrators,
  useDisputeActions,
  VOTE_CHOICES,
} from '@/hooks/useDisputeActions';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';

export function ArbitratorDashboardPage() {
  const { address, isAuthenticated } = useAuth();
  const stake = useArbitratorAccess();
  const [error, setError] = useState<string | null>(null);
  const [disputes, setDisputes] = useState<Array<{ _id: string; onchainJobId: number; status?: string }>>([]);
  const [onchainJobId, setOnchainJobId] = useState('');
  const [voteChoice, setVoteChoice] = useState(String(VOTE_CHOICES.FREELANCER_WIN));
  const [voteSalt, setVoteSalt] = useState('demo-salt-1');
  const [isChosen, setIsChosen] = useState(false);
  const {
    commitVote,
    revealVote,
    finalizeDisputeVoting,
    executeArbitrationResult,
    txStatus,
    txHash,
    txLabel,
    txError,
    resetTx,
  } = useDisputeActions();

  useEffect(() => {
    if (stake.error) setError(stake.error);
  }, [stake.error]);

  useEffect(() => {
    fetchDisputes({ status: 'OPEN', limit: 20 })
      .then((res) => {
        if (res.success) setDisputes(res.disputes || []);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const id = Number(onchainJobId);
    if (!id || !address) {
      setIsChosen(false);
      return;
    }
    readChosenArbitrators(id)
      .then((arbs) => setIsChosen(isAssignedArbitrator(arbs, address)))
      .catch(() => setIsChosen(false));
  }, [onchainJobId, address]);

  async function runVote(action: 'commit' | 'reveal' | 'finalize' | 'execute') {
    const id = Number(onchainJobId);
    if (!id) {
      setError('Nhập on-chain job ID.');
      return;
    }
    const choice = Number(voteChoice);
    setError(null);
    try {
      if (action === 'commit') await commitVote(id, choice, voteSalt);
      else if (action === 'reveal') await revealVote(id, choice, voteSalt);
      else if (action === 'finalize') await finalizeDisputeVoting(id);
      else await executeArbitrationResult(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giao dịch thất bại');
    }
  }

  return (
    <main className="page">
      <div className="page-header">
        <h2>Arbitrator console</h2>
        <p className="muted">
          Cần ≥ 50 USDC stake trên PlatformTreasury. Vote qua ArbitratorPanel khi được chọn vào hội
          đồng.
        </p>
      </div>

      {!isAuthenticated && <p className="muted">Connect wallet và đăng nhập SIWE.</p>}

      {stake.loading && <p className="muted">Loading stake status…</p>}
      {error && <p className="error">{error}</p>}

      {stake.stakedAmount != null && (
        <div className="stats-row">
          <div className="stat-card">
            <span className="stat-label">Staked USDC</span>
            <strong>{stake.stakedAmount}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Min stake</span>
            <strong>{stake.minStake ?? 50}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Eligible</span>
            <strong>{stake.isValid ? 'Yes' : 'No'}</strong>
          </div>
        </div>
      )}

      <section className="panel">
        <h3>Dispute queue (DB)</h3>
        {disputes.length === 0 ? (
          <p className="muted">Chưa có dispute OPEN trong DB — indexer sẽ sync sau raiseDispute on-chain.</p>
        ) : (
          <ul className="bids-list">
            {disputes.map((d) => (
              <li key={d._id} className="bid-item">
                <strong>Job #{d.onchainJobId}</strong>
                <span className="muted"> · {d.status}</span>
                <button
                  className="btn ghost"
                  type="button"
                  onClick={() => setOnchainJobId(String(d.onchainJobId))}
                >
                  Chọn
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel">
        <h4>Vote on dispute</h4>
        <p className="muted phase-note">
          Commit-reveal: hash = keccak256(choice, salt). Sepolia demo: evidence 0–
          {DISPUTE_PHASES.evidenceRebuttalEndMin}m → commit {DISPUTE_PHASES.commitStartMin}–
          {DISPUTE_PHASES.commitEndMin}m → reveal {DISPUTE_PHASES.revealStartMin}–
          {DISPUTE_PHASES.revealEndMin}m → finalize sau {DISPUTE_PHASES.revealEndMin}m.
        </p>

        <label className="field">
          On-chain job ID
          <input
            className="input full"
            value={onchainJobId}
            onChange={(e) => setOnchainJobId(e.target.value)}
            placeholder="5"
          />
        </label>

        {address && onchainJobId && (
          <p className={isChosen ? 'badge success' : 'badge warning'}>
            {isChosen
              ? 'Ví của bạn nằm trong hội đồng job này.'
              : 'Ví chưa được chọn — import private key arbitrator từ deployments/sepolia-arbitrators.json.'}
          </p>
        )}

        <label className="field">
          Vote choice
          <select className="input full" value={voteChoice} onChange={(e) => setVoteChoice(e.target.value)}>
            <option value={VOTE_CHOICES.FREELANCER_WIN}>1 — Freelancer thắng</option>
            <option value={VOTE_CHOICES.CLIENT_WIN}>2 — Client thắng</option>
            <option value={VOTE_CHOICES.SPLIT}>3 — Chia 50/50</option>
          </select>
        </label>

        <label className="field">
          Salt (giữ bí mật đến reveal)
          <input className="input full" value={voteSalt} onChange={(e) => setVoteSalt(e.target.value)} />
        </label>

        <div className="form-actions">
          <button className="btn primary" type="button" onClick={() => runVote('commit')} disabled={!isChosen}>
            Commit vote
          </button>
          <button className="btn ghost" type="button" onClick={() => runVote('reveal')} disabled={!isChosen}>
            Reveal vote
          </button>
          <button className="btn ghost" type="button" onClick={() => runVote('finalize')}>
            Finalize voting
          </button>
          <button className="btn ghost" type="button" onClick={() => runVote('execute')}>
            Execute result
          </button>
        </div>
      </section>

      {address && (
        <button
          className="btn ghost"
          type="button"
          onClick={() => fetchArbitratorStatus(address).then(() => window.location.reload())}
        >
          Refresh stake
        </button>
      )}

      <p className="muted">
        Stake qua <code>PlatformTreasury.stakeAsArbitrator</code> rồi admin <code>joinPool</code>. Xem{' '}
        <Link to="/profile">Profile</Link>.
      </p>

      <TxStatusModal
        open={txStatus !== 'idle'}
        status={txStatus}
        label={txLabel}
        hash={txHash}
        error={txError}
        onClose={resetTx}
      />
    </main>
  );
}
