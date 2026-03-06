import Link from 'next/link';
import { ReactNode } from 'react';

interface PrimaryButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  external?: boolean;
  className?: string;
  variant?: 'primary' | 'secondary';
}

export function PrimaryButton({
  children,
  href,
  onClick,
  external = false,
  className = '',
  variant = 'primary'
}: PrimaryButtonProps) {
  const baseClasses = 'inline-block px-8 py-4 rounded-xl text-lg font-bold transition-all duration-300 transform hover:scale-105 text-center';
  const variantClasses = variant === 'primary'
    ? 'bg-primary text-white hover:bg-primary/80'
    : 'bg-white/20 backdrop-blur-sm text-white border-2 border-white/30 hover:bg-white/30';

  const classes = `${baseClasses} ${variantClasses} ${className}`.trim();

  if (href) {
    if (external) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={classes}
        >
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button onClick={onClick} className={classes}>
      {children}
    </button>
  );
}

