import { type FormEvent, useEffect, useState } from 'react';
import { useAdminDisputePreview } from '@/hooks/useAdminDisputePreview';
import { DISPUTE_QUORUM } from '@/lib/utils/forceResolveEligibility';
import { VOTE_CHOICES, formatDisputeChoice } from '@/lib/utils/disputeChoice';
import { truncateAddress } from '@/lib/utils/address';
import { sendAdminForceResolveTx } from '@/lib/utils/sendAdminTx';
import { useContractTx } from '@/hooks/useContractTx';
import { TxStatusModal } from '@/components/shared/TxStatusModal';

const DISPUTE_FLOW_DOCS =
  'https://github.com/thanhltkk24414-lang/Blockchain/blob/dev/docs/guides/contract-interaction.md';

interface ForceResolvePanelProps {
  onComplete?: () => void;
  initialJobId?: string;
}

export function ForceResolvePanel({ onComplete, initialJobId = '' }: ForceResolvePanelProps) {
  const { txStatus, txHash, txLabel, txError, resetTx, runTx } = useContractTx();
  const [forceJobId, setForceJobId] = useState(initialJobId);
  const [forceDecision, setForceDecision] = useState(String(VOTE_CHOICES.FREELANCER_WIN));
  const [confirmQuorumFailed, setConfirmQuorumFailed] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const preview = useAdminDisputePreview(forceJobId);

  useEffect(() => {
    if (initialJobId) setForceJobId(initialJobId);
  }, [initialJobId]);

  const confirmOk = confirmQuorumFailed && confirmText.trim().toUpperCase() === 'FORCE';
  const canSubmit =
    preview.eligibility?.eligible === true && confirmOk && txStatus !== 'pending';

  const handleForceResolve = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const jobId = BigInt(forceJobId);
    const decision = Number(forceDecision);

    await runTx(`Force-resolving job #${jobId}…`, () => sendAdminForceResolveTx(jobId, decision));
    setConfirmQuorumFailed(false);
    setConfirmText('');
    preview.refresh();
    onComplete?.();
  };

  return (
    <section className="panel admin-danger-panel">
      <h3>Force resolve dispute</h3>

      <div className="admin-warning-banner admin-warning-banner-strong" role="alert">
        <strong>NOT used in normal dispute resolution.</strong> Standard disputes are settled by five
        arbitrators via commit–reveal voting. This panel is for emergency quorum failure only (
        &lt;{DISPUTE_QUORUM} valid reveals after the reveal window).
      </div>

      <form className="admin-form" onSubmit={handleForceResolve}>
        <label className="form-field">
          On-chain job ID
          <input
            type="number"
            className="input"
            min={1}
            value={forceJobId}
            onChange={(e) => setForceJobId(e.target.value)}
            placeholder="Enter job ID to load on-chain state"
            required
          />
        </label>

        {preview.loading && <p className="muted">Reading on-chain dispute state…</p>}
        {preview.error && <p className="error">{preview.error}</p>}

        {preview.dispute && preview.eligibility && (
          <div className="admin-dispute-preview">
            <h4 className="admin-subheading">On-chain dispute snapshot</h4>
            <dl className="detail-grid admin-dispute-grid">
              <dt>Job status</dt>
              <dd>{preview.onchainStatusLabel ?? '—'}</dd>
              <dt>Dispute phase</dt>
              <dd>{preview.eligibility.phaseLabel}</dd>
              <dt>Commit / reveal count</dt>
              <dd>
                {preview.dispute.commitCount} / {preview.dispute.revealCount} (quorum needs{' '}
                {DISPUTE_QUORUM})
              </dd>
              <dt>Reveal window ended</dt>
              <dd>{preview.eligibility.revealEnded ? 'Yes' : 'No'}</dd>
              <dt>Resolved by panel</dt>
              <dd>{preview.dispute.isResolved ? 'Yes' : 'No'}</dd>
            </dl>

            {preview.chosenArbitrators.length > 0 && (
              <>
                <h4 className="admin-subheading">Chosen arbitrators</h4>
                <ul className="admin-arb-list">
                  {preview.chosenArbitrators.map((arb) => (
                    <li key={arb}>
                      <code className="mono">{truncateAddress(arb)}</code>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <p
              className={
                preview.eligibility.eligible
                  ? 'admin-eligibility-ok phase-note'
                  : 'admin-eligibility-block phase-note'
              }
              role="status"
            >
              {preview.eligibility.reason}
            </p>
          </div>
        )}

        <label className="form-field">
          Decision (only if eligible)
          <select
            className="input"
            value={forceDecision}
            onChange={(e) => setForceDecision(e.target.value)}
            disabled={!preview.eligibility?.eligible}
          >
            <option value={String(VOTE_CHOICES.FREELANCER_WIN)}>
              {formatDisputeChoice(VOTE_CHOICES.FREELANCER_WIN)}
            </option>
            <option value={String(VOTE_CHOICES.CLIENT_WIN)}>
              {formatDisputeChoice(VOTE_CHOICES.CLIENT_WIN)}
            </option>
            <option value={String(VOTE_CHOICES.SPLIT)}>
              {formatDisputeChoice(VOTE_CHOICES.SPLIT)}
            </option>
          </select>
        </label>

        <label className="admin-confirm-checkbox">
          <input
            type="checkbox"
            checked={confirmQuorumFailed}
            onChange={(e) => setConfirmQuorumFailed(e.target.checked)}
            disabled={!preview.eligibility?.eligible}
          />
          I confirm arbitrator quorum has failed (&lt;{DISPUTE_QUORUM} valid reveals after reveal
          window)
        </label>

        <label className="form-field">
          Type FORCE to confirm emergency action
          <input
            type="text"
            className="input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="FORCE"
            autoComplete="off"
            disabled={!preview.eligibility?.eligible}
          />
        </label>

        <button
          type="submit"
          className="btn ghost admin-danger-btn"
          disabled={!canSubmit}
          title={!preview.eligibility?.eligible ? preview.eligibility?.reason : undefined}
        >
          adminForceResolve
        </button>
      </form>

      <p className="muted phase-note">
        Normal dispute flow:{' '}
        <a className="etherscan-link" href={DISPUTE_FLOW_DOCS} target="_blank" rel="noopener noreferrer">
          contract-interaction.md ↗
        </a>{' '}
        — open the disputed job page to run finalize / execute when quorum is met.
      </p>

      <TxStatusModal
        open={txStatus !== 'idle'}
        status={txStatus}
        label={txLabel}
        hash={txHash}
        error={txError}
        onClose={resetTx}
      />
    </section>
  );
}
