"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export function CTA() {
  return (
    <section className="px-4 py-20 md:py-28">
      <div className="mx-auto max-w-5xl rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground md:px-12 md:py-20">
        <h2 className="text-balance text-3xl font-bold tracking-tight md:text-4xl">
          Ready to work without middlemen?
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-base text-primary-foreground/80 md:text-lg">
          Join FAPEX and experience freelancing secured by smart contracts. Funds in escrow, milestone payouts, and
          on-chain reputation, all on Sepolia testnet.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="secondary">
            <Link href="/client">
              Hire a freelancer
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            size="lg"
            variant="outline"
            className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <Link href="/freelancer">Find work</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
