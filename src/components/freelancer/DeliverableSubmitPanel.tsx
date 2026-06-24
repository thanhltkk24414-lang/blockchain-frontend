import type { Job } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

interface DeliverableSubmitPanelProps {
  job: Job;
}

/**
 * Placeholder until EscrowVault.submitDeliverable is wired in a later phase.
 */
export function DeliverableSubmitPanel({ job }: DeliverableSubmitPanelProps) {
  const { address, user } = useAuth();
  const isAssignedFreelancer =
    user?.role === 'freelancer' &&
    address &&
    job.freelancerAddress?.toLowerCase() === address.toLowerCase();

  if (!isAssignedFreelancer) return null;

  return (
    <section className="panel deliverable-panel">
      <h3>Submit deliverable</h3>
      <p className="muted">
        On-chain deliverable upload (<code>submitDeliverable</code> + IPFS) is coming in a follow-up
        phase. For now, coordinate delivery with the client off-platform or via job metadata.
      </p>
      <ul className="muted checklist">
        <li>Package work (report, repo link, or assets)</li>
        <li>Pin to IPFS when uploader is integrated</li>
        <li>Call contract <code>submitDeliverable(jobId, cid)</code> from your wallet</li>
      </ul>
      {job.status === 'SUBMITTED' && <p className="badge success">Deliverable marked submitted on-chain.</p>}
    </section>
  );
}
