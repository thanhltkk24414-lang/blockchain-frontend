import { useCallback, useEffect, useMemo, useState } from 'react';
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
  readOnchainJob,
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
    notes?: string;
    repoUrl?: string;
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
  kind?: 'deliverable' | 'dispute';
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
  deliverable?: { cid: string; submitter: string; submittedAt?: number },
): DisplayEvidence[] {
  const byHash = new Map<string, DisplayEvidence>();
  const matchedOffChain = new Set<number>();

  if (deliverable?.cid) {
    byHash.set(`deliverable-${deliverable.cid}`, {
      key: `deliverable-${deliverable.cid}`,
      submitter: deliverable.submitter,
      submittedAt: deliverable.submittedAt,
      cid: deliverable.cid,
      description: 'Submitted deliverable (on-chain deliverableCID)',
      kind: 'deliverable',
    });
  }

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
      description: content?.description ?? content?.notes ?? ev.description,
      evidenceUrl: content?.evidenceUrl ?? content?.repoUrl,
      imageCid: content?.imageCid,
      kind: 'dispute',
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
        kind: 'dispute',
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
        kind: 'dispute',
      });
    } else {
      byHash.set(hashKey, {
        key: hashKey,
        submitter: ev.submitter,
        submittedAt: ev.submittedAt,
        onChainOnly: true,
        ipfsHashBytes: ev.ipfsHash,
        kind: 'dispute',
      });
    }
  }

  return [...byHash.values()].sort((a, b) => (b.submittedAt ?? 0) - (a.submittedAt ?? 0));
}

function EvidenceList({
  items,
  onRetry,
  retrying,
}: {
  items: DisplayEvidence[];
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const hasUnresolved = items.some((ev) => ev.onChainOnly);

  if (items.length === 0) {
    return <p className="muted phase-note">No evidence on-chain yet.</p>;
  }

  return (
    <>
      {hasUnresolved && onRetry && (
        <p className="muted phase-note">
          Some hashes are still resolving from IPFS.{' '}
          <button type="button" className="btn ghost btn-compact" onClick={onRetry} disabled={retrying}>
            {retrying ? 'Refreshing…' : 'Retry fetch'}
          </button>
        </p>
      )}
      <ul className="evidence-list">
        {items.map((ev) => (
          <li key={ev.key} className="evidence-item">
            <div className="evidence-meta">
              <strong>{shortAddr(ev.submitter)}</strong>
              {ev.kind === 'deliverable' && (
                <span className="badge success" style={{ marginLeft: '0.5rem' }}>
                  Deliverable
                </span>
              )}
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
                On-chain hash (<code className="mono">{ev.ipfsHashBytes?.slice(0, 14)}…</code>) —{' '}
                <a
                  href={`${IPFS_GATEWAY}/`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="etherscan-link"
                >
                  open IPFS gateway ↗
                </a>{' '}
                or retry if content was just pinned.
              </p>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function DisputeEvidencePanel({ job }: DisputeEvidencePanelProps) {
  const { address, isAuthenticated } = useAuth();
  const { onchainStatus, onchainJob } = useOnChainJob(job.onchainJobId, job.status);
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

  const displayStatus = (job.status?.toUpperCase() ?? 'OPEN') as string;
  const isDisputed =
    onchainStatus === ONCHAIN_JOB_STATUS.DISPUTED || displayStatus === 'DISPUTED';

  const showEvidenceSection = useMemo(() => {
    if (!isValidOnchainJobId(job.onchainJobId)) return false;
    const statuses = ['SUBMITTED', 'DISPUTED', 'COMPLETED'];
    if (statuses.includes(displayStatus)) return true;
    if (onchainStatus === ONCHAIN_JOB_STATUS.SUBMITTED) return true;
    if (onchainStatus === ONCHAIN_JOB_STATUS.DISPUTED) return true;
    if (onchainStatus === ONCHAIN_JOB_STATUS.COMPLETED) return true;
    return Boolean(onchainJob?.deliverableCID);
  }, [displayStatus, job.onchainJobId, onchainJob?.deliverableCID, onchainStatus]);

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
      const [onChain, dispute, chainJob] = await Promise.all([
        isDisputed ? readOnChainEvidences(jobId) : Promise.resolve([] as OnChainEvidence[]),
        isDisputed ? readOnchainDispute(jobId) : Promise.resolve({ createdAt: 0n } as Awaited<ReturnType<typeof readOnchainDispute>>),
        readOnchainJob(jobId).catch(() => null),
      ]);
      setCreatedAtSec(Number(dispute.createdAt));

      const deliverableCid =
        chainJob?.deliverableCID?.trim() ||
        onchainJob?.deliverableCID?.trim() ||
        '';
      const deliverable =
        deliverableCid && chainJob
          ? {
              cid: deliverableCid,
              submitter: chainJob.freelancer,
              submittedAt: chainJob.submittedAt ? Number(chainJob.submittedAt) : undefined,
            }
          : deliverableCid
            ? {
                cid: deliverableCid,
                submitter: job.freelancerAddress || job.clientAddress || '0x0000000000000000000000000000000000000000',
              }
            : undefined;

      let offChain: OffChainEvidence[] = [];
      if (job.onchainJobId != null) {
        const byOnchainEv = await fetchDisputeEvidencesByOnchainJob(job.onchainJobId).catch(
          () => null,
        );
        if (byOnchainEv?.success) {
          if (byOnchainEv.disputeId) setDisputeId(byOnchainEv.disputeId);
          if (byOnchainEv.evidence?.length) {
            offChain = byOnchainEv.evidence.filter((ev) =>
              Boolean(ev.ipfsHash || ev.onChainHash),
            ) as OffChainEvidence[];
          }
        }
      }

      if (offChain.length === 0 && job._id && isDisputed) {
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

      if (deliverableCid && offChain.length === 0) {
        try {
          const metaRes = await fetch(`${IPFS_GATEWAY}/${deliverableCid}`);
          if (metaRes.ok) {
            const meta = (await metaRes.json()) as OffChainEvidence['content'];
            if (meta && typeof meta === 'object') {
              offChain = [
                {
                  submitter: deliverable?.submitter || '',
                  ipfsHash: deliverableCid,
                  content: meta,
                },
              ];
            }
          }
        } catch {
          /* deliverable may be a raw file */
        }
      }

      setEvidenceItems(mergeEvidence(onChain, offChain, deliverable));
    } catch {
      setEvidenceItems([]);
    } finally {
      setListLoading(false);
    }
  }, [isDisputed, job._id, job.clientAddress, job.freelancerAddress, job.onchainJobId, onchainJob?.deliverableCID]);

  useEffect(() => {
    if (!showEvidenceSection) return;
    void loadEvidence();
  }, [showEvidenceSection, loadEvidence]);

  useEffect(() => {
    if (!showEvidenceSection) return;
    const hasUnresolved = evidenceItems.some((ev) => ev.onChainOnly);
    if (!hasUnresolved) return;
    const id = window.setInterval(() => void loadEvidence(), 12_000);
    return () => window.clearInterval(id);
  }, [evidenceItems, loadEvidence, showEvidenceSection]);

  useEffect(() => {
    if (!createdAtSec || !isDisputed) return;
    const tick = () => {
      const info = getDisputePhaseInfo(createdAtSec, 0, false);
      setEvidenceWindowOpen(info.phase === 'evidence');
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [createdAtSec, isDisputed]);

  if (!showEvidenceSection) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!job.onchainJobId || !address || !isDisputed) return;

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

      const resolvedHash = cidToEvidenceHash(upload.cid);
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
        onChainHash: resolvedHash,
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

  const canSubmit = isDisputed && isParty && evidenceWindowOpen;
  const panelTitle = isDisputed ? 'Dispute — evidence' : 'Evidence & deliverables';

  return (
    <section className="panel dispute-panel">
      <h3>{panelTitle}</h3>
      {isDisputed ? (
        <p className="muted">
          Job is <strong>DISPUTED</strong>. Client/freelancer submit evidence within the first{' '}
          <strong>{DISPUTE_PHASES.evidenceRebuttalEndMin} minutes</strong> (on-chain{' '}
          <code>submitEvidence</code>). Everyone can review evidence below — sourced from chain + IPFS.
        </p>
      ) : (
        <p className="muted">
          Public on-chain evidence for this job — deliverable CID and dispute attachments when present.
        </p>
      )}

      {listLoading && <p className="muted">Loading evidence…</p>}

      <div className="evidence-list-section">
        <h4>Evidence ({evidenceItems.length})</h4>
        <EvidenceList items={evidenceItems} onRetry={() => void loadEvidence()} retrying={listLoading} />
      </div>

      {!isDisputed && (
        <p className="muted phase-note">
          Dispute evidence upload unlocks when the job is <strong>DISPUTED</strong> on-chain.
        </p>
      )}

      {isDisputed && !evidenceWindowOpen && (
        <p className="muted phase-note">Evidence submission window closed — view only.</p>
      )}

      {isDisputed && !isParty && (
        <p className="muted">Only client/freelancer can submit new dispute evidence.</p>
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
