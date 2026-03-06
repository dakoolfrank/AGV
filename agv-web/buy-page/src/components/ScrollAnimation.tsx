'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

interface ScrollAnimationProps {
  children: ReactNode;
  direction?: 'left' | 'right' | 'top' | 'bottom' | 'scale' | 'rotate';
  delay?: number;
  className?: string;
}

export function ScrollAnimation({ 
  children, 
  direction = 'bottom', 
  delay = 0, 
  className = '' 
}: ScrollAnimationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMounted(true);
    
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (ref.current) {
        const observer = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
            }
          },
          {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
          }
        );

        observer.observe(ref.current);

        return () => {
          observer.disconnect();
        };
      }
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Don't render anything until mounted to prevent hydration mismatch
  if (!isMounted) {
    return (
      <div className={className}>
        {children}
      </div>
    );
  }

  const getInitialStyle = () => {
    if (!isVisible) {
      switch (direction) {
        case 'left':
          return { opacity: 0, transform: 'translateX(-80px)' };
        case 'right':
          return { opacity: 0, transform: 'translateX(80px)' };
        case 'top':
          return { opacity: 0, transform: 'translateY(-80px)' };
        case 'bottom':
          return { opacity: 0, transform: 'translateY(80px)' };
        case 'scale':
          return { opacity: 0, transform: 'scale(0.8)' };
        case 'rotate':
          return { opacity: 0, transform: 'rotate(-10deg) scale(0.8)' };
        default:
          return { opacity: 0, transform: 'translateY(80px)' };
      }
    }
    
    return { 
      opacity: 1, 
      transform: 'translateX(0) translateY(0) scale(1) rotate(0deg)'
    };
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ 
        ...getInitialStyle(),
        transition: 'all 0.7s ease-out',
        transitionDelay: `${delay}ms`
      }}
    >
      {children}
    </div>
  );
}
