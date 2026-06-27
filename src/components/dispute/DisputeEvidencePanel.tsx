import { useCallback, useEffect, useState } from 'react';
import type { Job } from '@/lib/api';
import {
  fetchDisputeByJob,
  fetchDisputeByOnchainJob,
  fetchDisputeEvidences,
  fetchDisputeEvidencesByOnchainJob,
  submitDisputeEvidence,
  submitDisputeEvidenceByOnchain,
  uploadIpfsFile,
  uploadIpfsMetadata,
} from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import {
  cidToEvidenceHash,
  readOnchainDispute,
  readOnChainEvidences,
  useDisputeActions,
  type OnChainEvidence,
} from '@/hooks/useDisputeActions';
import { useOnChainJob } from '@/hooks/useOnChainJob';
import { TxStatusModal } from '@/components/shared/TxStatusModal';
import { addressesEqual } from '@/lib/utils/address';
import { isValidOnchainJobId } from '@/lib/utils/etherscan';
import { DISPUTE_PHASES } from '@/lib/contracts/disputeTimings';
import { ONCHAIN_JOB_STATUS } from '@/lib/utils/onchainJob';
import { getDisputePhaseInfo } from '@/lib/utils/disputePhase';

const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

type OffChainEvidence = {
  submitter: string;
  ipfsHash: string;
  description?: string;
  submittedAt?: string;
  content?: {
    description?: string;
    evidenceUrl?: string;
    imageCid?: string;
    submitter?: string;
    type?: string;
  } | null;
};

type DisplayEvidence = {
  key: string;
  submitter: string;
  submittedAt?: number;
  cid?: string;
  description?: string;
  evidenceUrl?: string;
  imageCid?: string;
  onChainOnly?: boolean;
  ipfsHashBytes?: string;
};

interface DisputeEvidencePanelProps {
  job: Job;
}

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function mergeEvidence(
  onChain: OnChainEvidence[],
  offChain: OffChainEvidence[],
): DisplayEvidence[] {
  const byHash = new Map<string, DisplayEvidence>();
  const matchedOffChain = new Set<number>();

  for (const [idx, ev] of offChain.entries()) {
    let hashKey = '';
    try {
      hashKey = cidToEvidenceHash(ev.ipfsHash).toLowerCase();
    } catch {
      hashKey = ev.ipfsHash.toLowerCase();
    }
    const content = ev.content ?? undefined;
    byHash.set(hashKey || `off-${idx}`, {
      key: hashKey || ev.ipfsHash,
      submitter: ev.submitter,
      submittedAt: ev.submittedAt ? new Date(ev.submittedAt).getTime() / 1000 : undefined,
      cid: ev.ipfsHash,
      description: content?.description ?? ev.description,
      evidenceUrl: content?.evidenceUrl,
      imageCid: content?.imageCid,
    });
  }

  for (const ev of onChain) {
    const hashKey = ev.ipfsHash.toLowerCase();
    const existing = byHash.get(hashKey);
    if (existing) {
      byHash.set(hashKey, {
        ...existing,
        submitter: existing.submitter || ev.submitter,
        submittedAt: existing.submittedAt ?? ev.submittedAt,
      });
      const offIdx = offChain.findIndex((o) => {
        try {
          return cidToEvidenceHash(o.ipfsHash).toLowerCase() === hashKey;
        } catch {
          return o.ipfsHash.toLowerCase() === hashKey;
        }
      });
      if (offIdx >= 0) matchedOffChain.add(offIdx);
      continue;
    }

    const submitterLower = ev.submitter.toLowerCase();
    const fallbackIdx = offChain.findIndex(
      (o, idx) =>
        !matchedOffChain.has(idx) &&
        o.submitter.toLowerCase() === submitterLower &&
        Boolean(o.ipfsHash),
    );

    if (fallbackIdx >= 0) {
      matchedOffChain.add(fallbackIdx);
      const off = offChain[fallbackIdx];
      const content = off.content ?? undefined;
      byHash.set(hashKey, {
        key: hashKey,
        submitter: ev.submitter,
        submittedAt:
          ev.submittedAt ??
          (off.submittedAt ? new Date(off.submittedAt).getTime() / 1000 : undefined),
        cid: off.ipfsHash,
        description: content?.description ?? off.description,
        evidenceUrl: content?.evidenceUrl,
        imageCid: content?.imageCid,
      });
    } else {
      byHash.set(hashKey, {
        key: hashKey,
        submitter: ev.submitter,
        submittedAt: ev.submittedAt,
        onChainOnly: true,
        ipfsHashBytes: ev.ipfsHash,
      });
    }
  }

  return [...byHash.values()].sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
}

function EvidenceList({ items }: { items: DisplayEvidence[] }) {
  if (items.length === 0) {
    return <p className="muted phase-note">No evidence submitted yet.</p>;
  }

  return (
    <ul className="evidence-list">
      {items.map((ev) => (
        <li key={ev.key} className="evidence-item">
          <div className="evidence-meta">
            <strong>{shortAddr(ev.submitter)}</strong>
            {ev.submittedAt != null && (
              <span className="muted">
                {' '}
                · {new Date(ev.submittedAt * 1000).toLocaleString()}
              </span>
            )}
          </div>
          {ev.description && <p>{ev.description}</p>}
          {ev.evidenceUrl && (
            <p>
              <a href={ev.evidenceUrl} target="_blank" rel="noopener noreferrer">
                Evidence link ↗
              </a>
            </p>
          )}
          {ev.cid && (
            <p>
              <a
                href={`${IPFS_GATEWAY}/${ev.cid}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
              >
                IPFS: {ev.cid.slice(0, 20)}… ↗
              </a>
            </p>
          )}
          {ev.imageCid && (
            <a href={`${IPFS_GATEWAY}/${ev.imageCid}`} target="_blank" rel="noopener noreferrer">
              <img
                src={`${IPFS_GATEWAY}/${ev.imageCid}`}
                alt="Evidence attachment"
                className="evidence-thumb"
                loading="lazy"
              />
            </a>
          )}
          {ev.onChainOnly && (
            <p className="muted phase-note">
              On-chain hash only (<code className="mono">{ev.ipfsHashBytes?.slice(0, 14)}…</code>
              ) — fetching IPFS metadata; refresh if content was just submitted.
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

export function DisputeEvidencePanel({ job }: DisputeEvidencePanelProps) {
  const { address, isAuthenticated } = useAuth();
  const { onchainStatus } = useOnChainJob(job.onchainJobId, job.status);
  const { submitEvidence, txStatus, txHash, txLabel, txError, resetTx } = useDisputeActions();
  const [notes, setNotes] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [evidenceItems, setEvidenceItems] = useState<DisplayEvidence[]>([]);
  const [createdAtSec, setCreatedAtSec] = useState(0);
  const [evidenceWindowOpen, setEvidenceWindowOpen] = useState(true);

  const isDisputed =
    onchainStatus === ONCHAIN_JOB_STATUS.DISPUTED || job.status?.toUpperCase() === 'DISPUTED';

  const isParty = Boolean(
    address &&
      (addressesEqual(address, job.clientAddress) ||
        addressesEqual(address, job.freelancerAddress)),
  );

  const loadEvidence = useCallback(async () => {
    if (!isValidOnchainJobId(job.onchainJobId)) return;
    setListLoading(true);
    try {
      const jobId = BigInt(job.onchainJobId!);
      const [onChain, dispute] = await Promise.all([
        readOnChainEvidences(jobId),
        readOnchainDispute(jobId),
      ]);
      setCreatedAtSec(Number(dispute.createdAt));

      let offChain: OffChainEvidence[] = [];
      if (job.onchainJobId != null) {
        const byOnchainEv = await fetchDisputeEvidencesByOnchainJob(job.onchainJobId).catch(
          () => null,
        );
        if (byOnchainEv?.success && byOnchainEv.evidence?.length) {
          if (byOnchainEv.disputeId) setDisputeId(byOnchainEv.disputeId);
          offChain = byOnchainEv.evidence.filter((ev) => Boolean(ev.ipfsHash)) as OffChainEvidence[];
        }
      }

      if (offChain.length === 0 && job._id) {
        const byJob = await fetchDisputeByJob(job._id).catch(() => null);
        if (byJob?.success && byJob.dispute) {
          setDisputeId(byJob.dispute._id);
          if (byJob.dispute._id) {
            const evRes = await fetchDisputeEvidences(byJob.dispute._id).catch(() => null);
            if (evRes?.success && evRes.evidence) {
              offChain = evRes.evidence;
            } else {
              offChain = (byJob.dispute.evidence ?? []) as OffChainEvidence[];
            }
          }
        }
      }
      if (offChain.length === 0 && job.onchainJobId != null) {
        const byOnchain = await fetchDisputeByOnchainJob(job.onchainJobId).catch(() => null);
        if (byOnchain?.success && byOnchain.dispute) {
          setDisputeId(byOnchain.dispute._id);
          if (byOnchain.dispute._id) {
            const evRes = await fetchDisputeEvidences(byOnchain.dispute._id).catch(() => null);
            offChain =
              evRes?.success && evRes.evidence
                ? evRes.evidence
                : ((byOnchain.dispute.evidence ?? []) as OffChainEvidence[]);
          }
        }
      }

      setEvidenceItems(mergeEvidence(onChain, offChain));
    } catch {
      setEvidenceItems([]);
    } finally {
      setListLoading(false);
    }
  }, [job._id, job.onchainJobId]);

  useEffect(() => {
    if (!isDisputed) return;
    void loadEvidence();
  }, [isDisputed, loadEvidence]);

  useEffect(() => {
    if (!createdAtSec) return;
    const tick = () => {
      const info = getDisputePhaseInfo(createdAtSec, 0, false);
      setEvidenceWindowOpen(info.phase === 'evidence');
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [createdAtSec]);

  if (!isDisputed || !isValidOnchainJobId(job.onchainJobId)) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job.onchainJobId || !address) return;

    const trimmedNotes = notes.trim();
    const trimmedUrl = evidenceUrl.trim();
    const hasContent = trimmedNotes.length >= 10 || Boolean(imageFile) || trimmedUrl.length > 0;

    if (!hasContent) {
      setError('Add a description (≥10 chars), URL, or image attachment.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let imageCid: string | undefined;
      if (imageFile) {
        const imageUpload = await uploadIpfsFile(imageFile);
        imageCid = imageUpload.cid;
      }

      const upload = await uploadIpfsMetadata({
        type: 'dispute_evidence',
        jobId: job._id,
        onchainJobId: job.onchainJobId,
        submitter: address,
        description: trimmedNotes || undefined,
        evidenceUrl: trimmedUrl || undefined,
        imageCid,
        submittedAt: new Date().toISOString(),
      });

      if (!upload.cid?.trim()) {
        throw new Error('IPFS did not return a CID — retry upload.');
      }

      const evidenceHash = cidToEvidenceHash(upload.cid);
      await submitEvidence(job.onchainJobId, upload.cid);

      let resolvedDisputeId = disputeId;
      if (!resolvedDisputeId && job.onchainJobId != null) {
        const byOnchain = await fetchDisputeByOnchainJob(job.onchainJobId).catch(() => null);
        resolvedDisputeId = byOnchain?.dispute?._id ?? null;
        if (resolvedDisputeId) setDisputeId(resolvedDisputeId);
      }

      const evidencePayload = {
        ipfsHash: upload.cid,
        description: trimmedNotes || trimmedUrl || undefined,
        onChainHash: evidenceHash,
      };

      try {
        if (resolvedDisputeId) {
          await submitDisputeEvidence(resolvedDisputeId, evidencePayload);
        } else if (job.onchainJobId != null) {
          await submitDisputeEvidenceByOnchain(job.onchainJobId, evidencePayload);
        }
      } catch (apiErr) {
        setError(
          apiErr instanceof Error
            ? `On-chain OK but metadata save failed: ${apiErr.message}`
            : 'On-chain OK but off-chain metadata save failed.',
        );
      }

      setNotes('');
      setEvidenceUrl('');
      setImageFile(null);
      await loadEvidence();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Evidence submission failed');
    } finally {
      setLoading(false);
    }
  }

  const canSubmit = isParty && evidenceWindowOpen;

  return (
    <section className="panel dispute-panel">
      <h3>Dispute — evidence</h3>
      <p className="muted">
        Job is <strong>DISPUTED</strong>. Client/freelancer submit evidence within the first{' '}
        <strong>{DISPUTE_PHASES.evidenceRebuttalEndMin} minutes</strong> (on-chain{' '}
        <code>submitEvidence</code>). Arbitrators and parties can review the list below.
      </p>

      {listLoading && <p className="muted">Loading evidence…</p>}

      <div className="evidence-list-section">
        <h4>Submitted evidence ({evidenceItems.length})</h4>
        <EvidenceList items={evidenceItems} />
      </div>

      {!evidenceWindowOpen && (
        <p className="muted phase-note">
          Evidence submission window closed — view only.
        </p>
      )}

      {!isParty && (
        <p className="muted">Only client/freelancer can submit new evidence.</p>
      )}

      {canSubmit && (
        <form onSubmit={handleSubmit}>
          <h4>Submit new evidence</h4>
          <label className="field">
            Evidence description
            <textarea
              className="input textarea"
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Explain the dispute and summarize attachments…"
            />
          </label>

          <label className="field">
            Evidence link (optional)
            <input
              className="input full"
              type="url"
              value={evidenceUrl}
              onChange={(e) => setEvidenceUrl(e.target.value)}
              placeholder="https://drive.google.com/… or screenshot URL"
            />
          </label>

          <label className="field">
            Image attachment (optional)
            <input
              className="input full"
              type="file"
              accept="image/*"
              onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            />
            {imageFile && <span className="muted phase-note">{imageFile.name}</span>}
          </label>

          <button
            className="btn primary"
            type="submit"
            disabled={loading || txStatus === 'pending' || !isAuthenticated}
          >
            {loading || txStatus === 'pending'
              ? txLabel || 'Sending…'
              : 'Upload IPFS + submit on-chain'}
          </button>
          {error && <p className="error">{error}</p>}
        </form>
      )}

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
