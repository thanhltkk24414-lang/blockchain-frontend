import { Link } from 'react-router-dom';

export function LandingPage() {
  return (
    <main className="landing">
      <section className="hero">
        <p className="eyebrow">Live on Sepolia Testnet</p>
        <h2>Freelance work, secured by smart contracts</h2>
        <p className="lead">
          FAPEX connects clients and freelancers through on-chain escrow, milestone-based payments,
          and transparent dispute resolution.
        </p>
        <div className="hero-actions">
          <Link className="btn primary" to="/profile">
            Launch App
          </Link>
          <Link className="btn ghost" to="/browse">
            Browse open jobs
          </Link>
        </div>
      </section>

      <section className="features-grid">
        {[
          ['On-chain escrow', 'Funds locked in EscrowVault until milestones are approved.'],
          ['Milestone payments', 'Split jobs into milestones with automatic fund release.'],
          ['Transparent disputes', 'Evidence on IPFS, arbitrators settle on-chain.'],
          ['Soulbound reputation', 'Non-transferable scores in ReputationStore.'],
        ].map(([title, desc]) => (
          <article key={title} className="feature-card">
            <h3>{title}</h3>
            <p>{desc}</p>
          </article>
        ))}
      </section>

      <section className="roles-grid">
        <article className="role-card">
          <h3>For Clients</h3>
          <p>Post jobs, fund escrow, review milestones, approve or dispute deliverables.</p>
          <Link to="/client" className="btn outline">
            Client dashboard
          </Link>
        </article>
        <article className="role-card">
          <h3>For Freelancers</h3>
          <p>Browse jobs, submit proposals, deliver work, earn USDC on approval.</p>
          <Link to="/freelancer" className="btn outline">
            Freelancer dashboard
          </Link>
        </article>
        <article className="role-card">
          <h3>For Arbitrators</h3>
          <p>Review disputes, evidence on IPFS, vote and earn rewards.</p>
          <Link to="/arbitrator" className="btn outline">
            Arbitrator console
          </Link>
        </article>
      </section>
    </main>
  );
}
