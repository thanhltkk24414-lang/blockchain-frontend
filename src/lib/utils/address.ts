import { getAddress, isAddress, type Address } from 'viem';

/** Compare two wallet addresses (EIP-55 safe; different bytes → false). */
export function addressesEqual(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  try {
    return getAddress(a) === getAddress(b);
  } catch {
    return a.toLowerCase() === b.toLowerCase();
  }
}

/** Checksummed address for display / contract calls; throws if invalid. */
export function checksumAddress(addr: string): Address {
  return getAddress(addr);
}

/** Safe checksum — returns null when invalid. */
export function tryChecksumAddress(addr?: string | null): Address | null {
  if (!addr || !isAddress(addr)) return null;
  return getAddress(addr);
}

/** Short display form: 0x523e…92f7 */
export function truncateAddress(addr?: string | null, head = 6, tail = 4): string {
  if (!addr) return '—';
  if (addr.length <= head + tail + 3) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}
