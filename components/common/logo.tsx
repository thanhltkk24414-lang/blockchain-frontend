import Link from "next/link"
import { cn } from "@/lib/utils"

export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
          <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <path d="M12 7l4.5 2.5v5L12 17l-4.5-2.5v-5L12 7z" fill="currentColor" opacity="0.9" />
        </svg>
      </span>
      <span className="text-lg font-bold tracking-tight text-foreground">FAPEX</span>
    </Link>
  )
}
