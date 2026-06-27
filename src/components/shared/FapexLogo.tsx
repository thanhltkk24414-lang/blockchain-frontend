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

export function FapexLogo({ className, href = '/', showWordmark = true, size = 'md' }: FapexLogoProps) {
  const s = sizes[size];
  const content = (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src="/fapex-icon.svg" alt="" className={cn(s.icon, 'rounded-lg')} />
      {showWordmark && (
        <img src="/fapex-wordmark.svg" alt="FAPEX" className={cn(s.wordmark, 'hidden sm:block')} />
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
