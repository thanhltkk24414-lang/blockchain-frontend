"use client"

import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { etherscanTx, shortenAddress } from "@/lib/utils"
import type { TxStatus } from "@/lib/types"

interface TransactionModalProps {
  open: boolean
  status: TxStatus
  label: string
  hash: string
  error?: string
  onClose: () => void
}

export function TransactionModal({ open, status, label, hash, error, onClose }: TransactionModalProps) {
  return (
    <Modal open={open && status !== "idle"} onClose={status === "pending" ? () => {} : onClose} className="max-w-md">
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        {status === "pending" && (
          <>
            <Loader2 className="size-12 animate-spin text-primary" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Transaction pending</h3>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
              <p className="mt-1 text-xs text-muted-foreground">Confirm in your wallet and wait for the block.</p>
            </div>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="size-12 text-success" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Transaction confirmed</h3>
              <p className="mt-1 text-sm text-muted-foreground">{label}</p>
            </div>
          </>
        )}
        {status === "failed" && (
          <>
            <XCircle className="size-12 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold text-foreground">Transaction failed</h3>
              <p className="mt-1 text-sm text-muted-foreground">{error ?? "Something went wrong."}</p>
            </div>
          </>
        )}

        {hash && status !== "failed" && (
          <a
            href={etherscanTx(hash)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-secondary px-3 py-1.5 font-mono text-xs text-foreground hover:bg-secondary/70"
          >
            {shortenAddress(hash, 6)}
            <ExternalLink className="size-3.5" />
          </a>
        )}

        {status !== "pending" && (
          <Button onClick={onClose} variant={status === "success" ? "default" : "outline"} className="mt-2 w-full">
            {status === "success" ? "Done" : "Close"}
          </Button>
        )}
      </div>
    </Modal>
  )
}
