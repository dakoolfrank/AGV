'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface LoadingScreenProps {
  isLoading: boolean;
}

export function LoadingScreen({ isLoading }: LoadingScreenProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [shouldRender, setShouldRender] = useState(true);

  useEffect(() => {
    if (!isLoading) {
      // Start fade out animation
      setIsVisible(false);
      // Remove from DOM after animation completes
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 600); // Slightly longer than transition duration
      return () => clearTimeout(timer);
    } else {
      // Reset when loading starts again
      setIsVisible(true);
      setShouldRender(true);
    }
  }, [isLoading]);

  if (!shouldRender) return null;

  return (
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black transition-opacity duration-500 ease-in-out ${
        isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="flex flex-col items-center justify-center">
        {/* Logo with smooth scale and pulse animation */}
        <div
          className={`relative transition-all duration-500 ease-in-out ${
            isVisible 
              ? 'scale-100 opacity-100' 
              : 'scale-90 opacity-0'
          }`}
        >
          <div className="relative">
            {/* Subtle pulse animation */}
            <div className="absolute inset-0 animate-ping opacity-20">
              <Image
                src="/agv-logo.png"
                alt=""
                width={120}
                height={120}
                className="object-contain"
                aria-hidden="true"
              />
            </div>
            {/* Main logo */}
            <Image
              src="/agv-logo.png"
              alt="AGV Logo"
              width={120}
              height={120}
              priority
              className="object-contain relative z-10"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

