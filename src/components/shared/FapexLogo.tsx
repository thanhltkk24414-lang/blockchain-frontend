import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils/cn';

interface FapexLogoProps {
  className?: string;
  href?: string;
  showWordmark?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: { icon: 'h-7 w-7', wordmark: 'h-5' },
  md: { icon: 'h-8 w-8', wordmark: 'h-6' },
  lg: { icon: 'h-10 w-10', wordmark: 'h-7' },
};

function FapexWordmark({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 108 32"
      fill="none"
      aria-hidden
      className={className}
    >
      <text
        x="0"
        y="24"
        fontFamily="'Space Grotesk', system-ui, sans-serif"
        fontSize="24"
        fontWeight="700"
        fill="currentColor"
        letterSpacing="0.05em"
      >
        FAPEX
      </text>
    </svg>
  );
}

export function FapexLogo({ className, href = '/', showWordmark = true, size = 'md' }: FapexLogoProps) {
  const s = sizes[size];
  const content = (
    <span className={cn('inline-flex items-center gap-2.5 fapex-logo', className)}>
      <img
        src="/fapex-icon.png"
        alt=""
        className={cn(s.icon, 'fapex-logo-img object-contain')}
        draggable={false}
      />
      {showWordmark && (
        <FapexWordmark
          className={cn(
            s.wordmark,
            'fapex-logo-wordmark w-auto hidden sm:block text-foreground',
          )}
        />
      )}
      {!showWordmark && <span className="text-lg font-bold tracking-wide text-foreground">FAPEX</span>}
    </span>
  );

  return href ? (
    <Link to={href} className="inline-flex no-underline" aria-label="FAPEX home">
      {content}
    </Link>
  ) : (
    content
  );
}
