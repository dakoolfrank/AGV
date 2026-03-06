import { useEffect, useRef } from 'react';

type PageType = 'claim' | 'buy' | 'staking';

// Generate a simple session ID
function getSessionId(): string {
  if (typeof window === 'undefined') return '';
  
  let sessionId = sessionStorage.getItem('analytics_session_id');
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('analytics_session_id', sessionId);
  }
  return sessionId;
}

export function usePageTracking(pageType: PageType, walletAddress?: string) {
  const hasTracked = useRef(false);

  useEffect(() => {
    // Only track once per page load
    if (hasTracked.current) return;
    hasTracked.current = true;

    const eventType = `${pageType}_page_visit`;
    const sessionId = getSessionId();

    // Track page visit
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        eventType,
        walletAddress: walletAddress || undefined,
        sessionId,
      }),
    }).catch((error) => {
      console.error('Error tracking page visit:', error);
    });

    // Track drop-off when user leaves the page
    const handleBeforeUnload = () => {
      // Track drop-off event
      fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventType: `${pageType}_dropoff`,
          walletAddress: walletAddress || undefined,
          sessionId,
          metadata: {
            dropoffStage: 'page_visit',
            dropoffReason: 'page_unload',
          },
        }),
      }).catch(() => {
        // Silently fail - user is leaving anyway
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [pageType, walletAddress]);
}

export async function trackStakingEvent(
  walletAddress: string,
  amount: number,
  positionId?: number,
  txHash?: string
) {
  try {
    await fetch('/api/analytics/staking-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress,
        amount,
        positionId,
        txHash,
      }),
    });
  } catch (error) {
    console.error('Error tracking staking event:', error);
  }
}

