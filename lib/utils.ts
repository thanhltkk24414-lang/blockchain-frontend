import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Shorten an ethereum address: 0x1234...5678 */
export function shortenAddress(address: string, chars = 4): string {
  if (!address) return ""
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`
}

/** Format a USDC amount with thousands separators */
export function formatUSDC(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Format ETH balance */
export function formatETH(amount: number): string {
  return amount.toFixed(4)
}

/** Compute the escrow total a client must deposit (contract value + 3% platform fee) */
export function escrowTotal(contractValue: number): number {
  return Math.round(contractValue * 1.03 * 100) / 100
}

/** Etherscan link helper for Sepolia */
export function etherscanTx(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`
}

export function etherscanAddress(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`
}

/** Human readable "time left" for a future timestamp (ms) */
export function timeLeft(deadline: number): string {
  const diff = deadline - Date.now()
  if (diff <= 0) return "Expired"
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (days > 0) return `${days}d ${hours}h left`
  if (hours > 0) return `${hours}h ${mins}m left`
  return `${mins}m left`
}
