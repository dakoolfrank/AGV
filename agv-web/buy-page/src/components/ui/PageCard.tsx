'use client';

import { ReactNode, CSSProperties } from 'react';

interface PageCardProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function PageCard({ children, className = '', style }: PageCardProps) {
  return (
    <div 
      className={`bg-white/5 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-white/20 shadow-2xl ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

