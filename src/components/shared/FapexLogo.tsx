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
    <span className={cn('inline-flex items-center gap-2.5 fapex-logo', className)}>
      <img
        src="/fapex-icon.png"
        alt=""
        className={cn(s.icon, 'fapex-logo-img object-contain shrink-0')}
        draggable={false}
      />
      {showWordmark && (
        <img
          src="/fapex-wordmark.png"
          alt=""
          className={cn(s.wordmark, 'fapex-logo-wordmark w-auto hidden sm:block object-contain object-left')}
          draggable={false}
        />
      )}
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
