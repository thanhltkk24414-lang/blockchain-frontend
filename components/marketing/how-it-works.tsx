const STEPS = [
  { n: "01", title: "Post & fund", desc: "Client posts a job with milestones and deposits the contract value plus a 3% fee into escrow." },
  { n: "02", title: "Hire talent", desc: "Freelancers submit proposals. The client compares reputation scores and assigns the best fit." },
  { n: "03", title: "Deliver & approve", desc: "The freelancer submits deliverables to IPFS. Each approved milestone releases its funds instantly." },
  { n: "04", title: "Resolve fairly", desc: "If something goes wrong, either party opens a dispute and arbitrators decide an on-chain split." },
]

export function HowItWorks() {
  return (
    <section id="how" className="border-y border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            How FAPEX works
          </h2>
          <p className="mt-4 text-muted-foreground">From posting to payout in four trustless steps.</p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              <span className="font-mono text-3xl font-bold text-primary/30">{s.n}</span>
              <h3 className="mt-3 font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              {i < STEPS.length - 1 && (
                <span className="absolute -right-3 top-4 hidden h-px w-6 bg-border lg:block" aria-hidden />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
