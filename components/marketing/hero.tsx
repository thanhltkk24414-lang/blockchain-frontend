import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-60" aria-hidden />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />
      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" />
            Live on Sepolia Testnet
          </div>
          <h1 className="mt-6 text-balance text-4xl font-bold leading-[1.1] tracking-tight text-foreground sm:text-6xl">
            Freelance work, secured by smart contracts
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            FAPEX connects clients and freelancers through on-chain escrow, milestone-based payments and transparent
            dispute resolution. No middlemen holding your funds — just code you can verify.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="gap-2">
              <Link href="/login">
                Launch App <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/freelancer/browse">Browse open jobs</Link>
            </Button>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-4 text-success" />
            Funds held in audited escrow vaults until milestones are approved
          </div>
        </div>

        <div className="relative mx-auto mt-16 max-w-5xl">
          <div className="absolute -inset-x-8 -top-8 bottom-0 rounded-3xl bg-primary/5 blur-3xl" aria-hidden />
          <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
            <Image
              src="/hero-dashboard.png"
              alt="FAPEX dashboard showing escrow balances, milestone progress and job status"
              width={1200}
              height={750}
              className="h-auto w-full"
              priority
            />
          </div>
        </div>

        <dl className="mx-auto mt-16 grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-4">
          {[
            { v: "$2.4M+", l: "Escrow secured" },
            { v: "1,200+", l: "Jobs completed" },
            { v: "98.6%", l: "Dispute fairness" },
            { v: "3%", l: "Platform fee" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <dt className="text-2xl font-bold text-foreground sm:text-3xl">{s.v}</dt>
              <dd className="mt-1 text-sm text-muted-foreground">{s.l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
