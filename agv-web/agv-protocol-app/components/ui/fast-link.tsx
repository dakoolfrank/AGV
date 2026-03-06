"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";

interface FastLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  prefetch?: boolean;
}

export function FastLink({ 
  href, 
  children, 
  className, 
  onClick,
  prefetch = true 
}: FastLinkProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isNavigating, setIsNavigating] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    
    // Call custom onClick if provided
    if (onClick) {
      onClick();
    }

    // Set navigating state immediately for visual feedback
    setIsNavigating(true);

    // Use startTransition for smooth navigation
    startTransition(() => {
      router.push(href);
      // Reset navigating state after a short delay
      setTimeout(() => setIsNavigating(false), 100);
    });
  };

  return (
    <Link
      href={href}
      onClick={handleClick}
      prefetch={prefetch}
      className={cn(
        "transition-opacity duration-150",
        (isPending || isNavigating) && "opacity-70",
        className
      )}
    >
      {children}
    </Link>
  );
}
