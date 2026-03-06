'use client';

import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BoxProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const paddingMap = {
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
  xl: 'p-10'
};

const roundedMap = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  '2xl': 'rounded-2xl'
};

export function Box({
  children,
  className = '',
  padding = 'lg',
  rounded = '2xl'
}: BoxProps) {
  return (
    <div
      className={cn(
        'bg-white/10 backdrop-blur-sm border border-blue-400/50',
        paddingMap[padding],
        roundedMap[rounded],
        className
      )}
    >
      {children}
    </div>
  );
}

