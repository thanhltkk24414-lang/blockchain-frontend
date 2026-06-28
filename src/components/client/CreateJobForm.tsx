import { useState, type FormEvent } from 'react';
import { useAccount, useChainId } from 'wagmi';
import { isAddress } from 'viem';
import { createJob, syncOnchainJob, uploadIpfsMetadata } from '@/lib/api';
import { USE_RELAYED_CREATE_JOB } from '@/config/env';
import { useAuth } from '@/context/AuthContext';
import { useCreateJob } from '@/hooks/useCreateJob';
import { useWalletAccountSync } from '@/hooks/useWalletAccountSync';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { TxRecoveryModal } from '@/components/shared/TxRecoveryModal';
import { WalletAccountIndicator } from '@/components/shared/WalletAccountIndicator';
import { CHAIN_ID, CONTRACT_ADDRESSES } from '@/lib/contracts/addresses';
import {
  EMPTY_CREATE_JOB_FORM,
  JOB_CATEGORIES,
  formValuesToPayload,
  validateCreateJobForm,
  type CreateJobFormValues,
} from '@/lib/validation/jobForm';
import type { CreateJobPayload } from '@/lib/validation/jobForm';
import type { Job } from '@/lib/api';

interface CreateJobFormProps {
  onCreated: (job: Job) => void;
  onCancel?: () => void;
}

export function CreateJobForm({ onCreated, onCancel }: CreateJobFormProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { user, isAuthenticated, signIn, loading: authLoading } = useAuth();
  const {
    signingAddress,
    siweMismatch,
    rainbowMismatch,
    metaMaskActive,
    shortMetaMask,
    shortSiwe,
    refresh: refreshAccounts,
  } = useWalletAccountSync();
  const {
    createOnChain,
    txStatus,
    txHash,
    txLabel,
    txError,
    txDebug,
    showRecovery,
    setShowRecovery,
    resetTx,
  } = useCreateJob();
  const [values, setValues] = useState<CreateJobFormValues>(EMPTY_CREATE_JOB_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState<'idle' | 'ipfs' | 'onchain' | 'api'>('idle');
  const [collisionPayload, setCollisionPayload] = useState<
    (CreateJobPayload & { onchainJobId: number }) | null
  >(null);
  const [syncing, setSyncing] = useState(false);

  function updateField<K extends keyof CreateJobFormValues>(key: K, value: CreateJobFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    setCollisionPayload(null);

    const errors = validateCreateJobForm(values);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const txWallet = signingAddress ?? address;
    if (!isConnected || !txWallet) {
      setSubmitError('Connect your MetaMask wallet on Sepolia before creating a job.');
      return;
    }
    if (!isAddress(txWallet)) {
      setSubmitError(
        `Invalid MetaMask address (${String(txWallet).length} characters). Must be 0x + 40 hex characters.`,
      );
      return;
    }
    if (chainId !== CHAIN_ID) {
      setSubmitError(`Switch MetaMask to Sepolia (chainId ${CHAIN_ID}) — currently: ${chainId ?? 'unknown'}.`);
      return;
    }
    if (!isAuthenticated || !user?.walletAddress) {
      setSubmitError('Sign in with SIWE before creating a job.');
      return;
    }
    if (txWallet.toLowerCase() !== user.walletAddress.toLowerCase()) {
      setSubmitError(
        `SIWE session: ${shortSiwe} · MetaMask active: ${shortMetaMask ?? '—'} — ` +
          'createJob uses the currently selected MetaMask wallet. Sign in again with the active MetaMask account.',
      );
      return;
    }
    if (rainbowMismatch) {
      setSubmitError(
        'Fapex and MetaMask accounts do not match — select the correct Account in the extension or Disconnect → Connect again.',
      );
      return;
    }

    const payload = formValuesToPayload(values);
    setSubmitting(true);

    try {
      setStep('ipfs');
      const metadataRes = await uploadIpfsMetadata({
        title: payload.title,
        description: payload.description,
        category: payload.category,
        skills: payload.skills,
        deliverables: payload.deliverables,
        acceptanceCriteria: payload.acceptanceCriteria,
        clientAddress: txWallet,
        createdAt: new Date().toISOString(),
      });
      if (!metadataRes.success || !metadataRes.cid) {
        throw new Error('IPFS metadata upload failed — verify SIWE login and Pinata backend.');
      }

      if (USE_RELAYED_CREATE_JOB) {
        setStep('api');
        const res = await createJob({
          ...payload,
          metadataCID: metadataRes.cid,
          relayCreateJob: true,
        });
        if (!res.success || !res.job) {
          const detail = [res.error, res.hint].filter(Boolean).join(' — ');
          throw new Error(detail || 'Failed to register job in API (relay mode)');
        }
        onCreated(res.job);
        setValues(EMPTY_CREATE_JOB_FORM);
        resetTx();
        return;
      }

      const activeNow = signingAddress ?? address;
      if (!activeNow || activeNow.toLowerCase() !== user.walletAddress.toLowerCase()) {
        throw new Error(
          `MetaMask wallet changed during IPFS upload — switch back to ${shortSiwe} before signing createJob.`,
        );
      }

      setStep('onchain');
      const { onchainJobId, createTxHash } = await createOnChain({
        metadataCID: metadataRes.cid,
        contractValue: payload.contractValue,
        durationSeconds: payload.duration,
      });

      setStep('api');
      const apiPayload = {
        ...payload,
        onchainJobId,
        metadataCID: metadataRes.cid,
        createTxHash,
      };
      let res = await createJob(apiPayload);
      if (!res.success && res.code === 'ONCHAIN_JOB_ID_COLLISION') {
        res = await createJob(apiPayload);
      }
      if (!res.success && res.code === 'ONCHAIN_JOB_ID_COLLISION') {
        setCollisionPayload(apiPayload);
        const detail = [res.error, res.hint].filter(Boolean).join(' — ');
        throw new Error(
          detail ||
            `On-chain job id ${onchainJobId} exists in the database — use Sync on-chain job below.`,
        );
      }
      if (!res.success || !res.job) {
        const detail = [res.error, res.hint].filter(Boolean).join(' — ');
        throw new Error(
          detail ||
            'Failed to register job in API. Your on-chain job was created — open Client dashboard and use "Retry API sync" or submit the form again (same wallet).',
        );
      }

      onCreated(res.job);
      setValues(EMPTY_CREATE_JOB_FORM);
      resetTx();
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to create job';
      const prefix =
        step === 'ipfs' ? '[IPFS] ' : step === 'onchain' ? '[On-chain] ' : step === 'api' ? '[API] ' : '';
      setSubmitError(`${prefix}${raw}`);
    } finally {
      setSubmitting(false);
      setStep('idle');
    }
  }

  async function handleSyncOnchain() {
    if (!collisionPayload) return;
    setSyncing(true);
    setSubmitError(null);
    try {
      const res = await syncOnchainJob(collisionPayload);
      if (!res.success || !res.job) {
        const detail = [res.error, res.hint].filter(Boolean).join(' — ');
        throw new Error(detail || 'Failed to sync job from chain');
      }
      onCreated(res.job);
      setValues(EMPTY_CREATE_JOB_FORM);
      setCollisionPayload(null);
      resetTx();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to sync job from chain');
    } finally {
      setSyncing(false);
    }
  }

  const stepLabel =
    step === 'ipfs'
      ? 'Uploading metadata to IPFS…'
      : step === 'onchain'
        ? 'Confirm createJob in MetaMask…'
        : step === 'api'
          ? 'Saving job to API…'
          : null;

  return (
    <form className="create-job-form" onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="job-title">Title</label>
        <input
          id="job-title"
          className="input full"
          value={values.title}
          onChange={(e) => updateField('title', e.target.value)}
          placeholder="Smart Contract Audit (5–100 chars)"
          maxLength={100}
        />
        {fieldErrors.title && <span className="field-error">{fieldErrors.title}</span>}
      </div>

      <div className="field">
        <label htmlFor="job-description">Description</label>
        <textarea
          id="job-description"
          className="input full textarea"
          rows={4}
          value={values.description}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="At least 20 characters…"
        />
        {fieldErrors.description && <span className="field-error">{fieldErrors.description}</span>}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="job-category">Category</label>
          <select
            id="job-category"
            className="input full"
            value={values.category}
            onChange={(e) => updateField('category', e.target.value)}
          >
            {JOB_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          {fieldErrors.category && <span className="field-error">{fieldErrors.category}</span>}
        </div>

        <div className="field">
          <label htmlFor="job-budget">Budget (USDC)</label>
          <input
            id="job-budget"
            className="input full"
            type="number"
            min={1}
            step={1}
            value={values.contractValue}
            onChange={(e) => updateField('contractValue', e.target.value)}
          />
          {fieldErrors.contractValue && (
            <span className="field-error">{fieldErrors.contractValue}</span>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor="job-skills">Skills (comma-separated)</label>
        <input
          id="job-skills"
          className="input full"
          value={values.skills}
          onChange={(e) => updateField('skills', e.target.value)}
          placeholder="Solidity, Security, Hardhat"
        />
      </div>

      <div className="field">
        <label htmlFor="job-duration">Duration (days)</label>
        <input
          id="job-duration"
          className="input full"
          type="number"
          min={1}
          step={1}
          value={values.durationDays}
          onChange={(e) => updateField('durationDays', e.target.value)}
        />
        <span className="muted phase-note">Minimum 1 day ({86400} seconds on-chain).</span>
        {fieldErrors.durationDays && <span className="field-error">{fieldErrors.durationDays}</span>}
      </div>

      <div className="field">
        <label htmlFor="job-deliverables">Deliverables</label>
        <textarea
          id="job-deliverables"
          className="input full textarea"
          rows={3}
          value={values.deliverables}
          onChange={(e) => updateField('deliverables', e.target.value)}
        />
        {fieldErrors.deliverables && <span className="field-error">{fieldErrors.deliverables}</span>}
      </div>

      <div className="field">
        <label htmlFor="job-acceptance">Acceptance criteria</label>
        <textarea
          id="job-acceptance"
          className="input full textarea"
          rows={3}
          value={values.acceptanceCriteria}
          onChange={(e) => updateField('acceptanceCriteria', e.target.value)}
        />
        {fieldErrors.acceptanceCriteria && (
          <span className="field-error">{fieldErrors.acceptanceCriteria}</span>
        )}
      </div>

      <WalletAccountIndicator showSiwe={isAuthenticated} compact />

      {USE_RELAYED_CREATE_JOB && (
        <div className="panel wallet-mismatch-banner" role="alert" style={{ marginTop: '0.75rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            <strong>Demo mode — relayed createJob.</strong> The backend uses the INDEXER wallet for
            on-chain calls; funding escrow later requires the INDEXER wallet (not the client wallet).
            Disable <code>VITE_USE_RELAYED_CREATE_JOB</code> to sign createJob from MetaMask.
          </p>
        </div>
      )}

      {siweMismatch && isAuthenticated && (
        <div className="panel wallet-mismatch-banner" role="alert" style={{ marginTop: '0.75rem' }}>
          <p className="error" style={{ margin: 0 }}>
            SIWE ({shortSiwe}) differs from MetaMask active ({shortMetaMask ?? '—'}).{' '}
            <button
              type="button"
              className="btn ghost"
              disabled={authLoading}
              onClick={() => void signIn()}
            >
              Sign in again with current MetaMask
            </button>
          </p>
        </div>
      )}

      {import.meta.env.DEV && (
        <div
          className="muted phase-note"
          style={{
            marginTop: '0.75rem',
            padding: '0.5rem 0.75rem',
            border: '1px dashed #666',
            borderRadius: 6,
            fontSize: '0.85rem',
          }}
        >
          <strong>DEV — createJob debug</strong>
          <div>Fapex connected: {address ?? '—'}</div>
          <div>MetaMask active: {metaMaskActive ?? '—'}</div>
          <div>signing: {signingAddress ?? '—'}</div>
          <div>chainId: {chainId ?? '—'} (required: {CHAIN_ID})</div>
          <div>JobRegistry: {CONTRACT_ADDRESSES.JobRegistry}</div>
          <div>
            calldata length:{' '}
            {txDebug?.calldataLength ??
              (submitting && step === 'onchain' ? 'signing…' : '— (after IPFS upload)')}
          </div>
        </div>
      )}

      {submitError && <p className="error">{submitError}</p>}
      {collisionPayload && (
        <div className="panel wallet-mismatch-banner" role="alert" style={{ marginTop: '0.75rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            Your wallet owns on-chain job id <strong>{collisionPayload.onchainJobId}</strong>, but MongoDB has a
            conflicting row. Sync links the API record to your on-chain job.
          </p>
          <button
            type="button"
            className="btn primary"
            style={{ marginTop: '0.75rem' }}
            disabled={syncing || submitting}
            onClick={() => void handleSyncOnchain()}
          >
            {syncing ? 'Syncing…' : 'Sync on-chain job'}
          </button>
        </div>
      )}
      {stepLabel && submitting && <p className="muted phase-note">{stepLabel}</p>}

      <div className="form-actions">
        {onCancel && (
          <button className="btn ghost" type="button" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
        )}
        <button className="btn primary" type="submit" disabled={submitting || txStatus === 'pending'}>
          {submitting ? 'Creating…' : 'Create job'}
        </button>
      </div>
      <p className="muted phase-note">
        {USE_RELAYED_CREATE_JOB ? (
          <>
            Relay demo: backend calls <code>JobRegistry.createJob</code> via INDEXER wallet. Production:
            disable <code>VITE_USE_RELAYED_CREATE_JOB</code> and sign from MetaMask.
          </>
        ) : (
          <>
            You sign <code>JobRegistry.createJob</code> from MetaMask (Sepolia ETH required for gas). The backend
            only stores IPFS metadata and syncs MongoDB — the same wallet will fund escrow after accepting a bid.
          </>
        )}
      </p>

      <TxStatusModal
        open={txStatus !== 'idle'}
        status={txStatus}
        label={txLabel}
        hash={txHash}
        error={txError ?? submitError ?? undefined}
        onClose={resetTx}
      />
      <TxRecoveryModal
        open={showRecovery}
        error={txError}
        onClose={() => setShowRecovery(false)}
        onRetry={() => {
          setShowRecovery(false);
          resetTx();
          void refreshAccounts();
        }}
      />
    </form>
  );
}
