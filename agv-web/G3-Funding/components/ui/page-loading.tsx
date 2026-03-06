"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export function PageLoading() {
  const [isLoading, setIsLoading] = useState(false);
  const pathname = usePathname();
  const timeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  // Show a brief top loader whenever the URL path changes.
  // We avoid monkey-patching history.* (which can trigger
  // "useInsertionEffect must not schedule updates") and instead
  // defer the state update to the next animation frame.
  useEffect(() => {
    rafRef.current = window.requestAnimationFrame(() => {
      setIsLoading(true);
      // keep visible briefly to avoid flicker
      timeoutRef.current = window.setTimeout(() => {
        setIsLoading(false);
        timeoutRef.current = null;
      }, 400);
    });

    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [pathname]);

  if (!isLoading) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-1 bg-primary/20">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out animate-pulse"
          style={{
            width: "100%",
            background: "linear-gradient(90deg, transparent, hsl(var(--primary)), transparent)",
            animation: "shimmer 1.5s infinite"
          }}
        />
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
