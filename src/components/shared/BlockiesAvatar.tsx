import { useMemo } from 'react';
import { cn } from '@/lib/utils/cn';

function seedFromAddress(address: string): number {
  let hash = 0;
  const normalized = address.toLowerCase();
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function colorFromSeed(seed: number, offset: number): string {
  const hue = (seed + offset * 47) % 360;
  return `hsl(${hue} 65% 45%)`;
}

interface BlockiesAvatarProps {
  address: string;
  size?: number;
  className?: string;
}

/** Wallet identicon (blockies-style grid). */
export function BlockiesAvatar({ address, size = 48, className }: BlockiesAvatarProps) {
  const cells = useMemo(() => {
    const seed = seedFromAddress(address);
    const grid: boolean[] = [];
    for (let y = 0; y < 5; y += 1) {
      for (let x = 0; x < 5; x += 1) {
        const mirrorX = x < 3 ? x : 4 - x;
        const bit = ((seed >> (y * 3 + mirrorX)) & 1) === 1;
        grid.push(bit);
      }
    }
    return grid;
  }, [address]);

  const bg = colorFromSeed(seedFromAddress(address), 0);
  const fg = colorFromSeed(seedFromAddress(address), 3);
  const cellSize = size / 5;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('blockies-avatar', className)}
      aria-hidden
    >
      <rect width={size} height={size} fill={bg} rx={size * 0.2} />
      {cells.map((on, i) =>
        on ? (
          <rect
            key={i}
            x={(i % 5) * cellSize}
            y={Math.floor(i / 5) * cellSize}
            width={cellSize}
            height={cellSize}
            fill={fg}
          />
        ) : null,
      )}
    </svg>
  );
}
