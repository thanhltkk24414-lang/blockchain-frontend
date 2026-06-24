import Link from "next/link"
import { ArrowRight, Briefcase, ShieldCheck, Users } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const ROLES = [
  {
    icon: Briefcase,
    title: "For Clients",
    desc: "Post jobs, fund escrow, review milestones and release payments only when you are satisfied.",
    href: "/client/dashboard",
    cta: "Open client dashboard",
    points: ["Create milestone-based jobs", "Compare freelancer proposals", "Approve or dispute deliverables"],
  },
  {
    icon: Users,
    title: "For Freelancers",
    desc: "Browse open jobs, submit proposals, deliver work and get paid in USDC the moment it is approved.",
    href: "/freelancer/dashboard",
    cta: "Open freelancer dashboard",
    points: ["Browse & filter open jobs", "Track earnings and milestones", "Build on-chain reputation"],
  },
  {
    icon: ShieldCheck,
    title: "For Arbitrators",
    desc: "Stake USDC, review disputes with full evidence and earn rewards for fair, accurate rulings.",
    href: "/admin/dashboard",
    cta: "Open admin console",
    points: ["Resolve disputes on-chain", "Review IPFS evidence", "Manage protocol settings"],
  },
]

export function Roles() {
  return (
    <section id="roles" className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          Built for everyone in the loop
        </h2>
        <p className="mt-4 text-muted-foreground">Choose your role and jump straight into the right workspace.</p>
      </div>
      <div className="mt-12 grid gap-6 lg:grid-cols-3">
        {ROLES.map((r) => (
          <Card key={r.title} className="flex flex-col p-6">
            <div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <r.icon className="size-5" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">{r.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{r.desc}</p>
            <ul className="mt-4 space-y-2">
              {r.points.map((p) => (
                <li key={p} className="flex items-center gap-2 text-sm text-foreground">
                  <span className="size-1.5 rounded-full bg-primary" /> {p}
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-6 w-full gap-2">
              <Link href={r.href}>
                {r.cta} <ArrowRight className="size-4" />
              </Link>
            </Button>
          </Card>
        ))}
      </div>
    </section>
  )
}

export function CTA() {
  return (
    <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <div className="relative overflow-hidden rounded-2xl border border-border bg-primary px-6 py-14 text-center">
        <div className="absolute inset-0 grid-pattern opacity-20" aria-hidden />
        <div className="relative">
          <h2 className="text-balance text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Start working trustlessly today
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-primary-foreground/80">
            Connect your wallet, pick a role, and experience freelance work where the smart contract is the escrow agent.
          </p>
          <Button asChild size="lg" variant="secondary" className="mt-8">
            <Link href="/login">Launch FAPEX</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
