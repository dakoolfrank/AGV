'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircledIcon } from '@radix-ui/react-icons';
import { useTranslations } from '@/lib/translation-provider';

const DISCORD_LINK = 'https://discord.com/invite/JP9RtzM2SC';
const TWITTER_LINK = 'https://x.com/AgvProtocol';

interface SocialVerificationProps {
  address: string;
  onVerificationChange?: (discordVisited: boolean, twitterVisited: boolean) => void;
  onCheckingChange?: (isChecking: boolean) => void;
}

export function SocialVerification({ address, onVerificationChange, onCheckingChange }: SocialVerificationProps) {
  const { t } = useTranslations('socialVerification');
  const [discordVerified, setDiscordVerified] = useState(false);
  const [twitterVisited, setTwitterVisited] = useState(false);
  const [isCheckingDiscord, setIsCheckingDiscord] = useState(false);
  const searchParams = useSearchParams();

  // Link Discord account to wallet
  const linkDiscordAccount = async () => {
    if (!address) return;

    setIsCheckingDiscord(true);
    if (onCheckingChange) {
      onCheckingChange(true);
    }

    try {
      const response = await fetch('/api/link-discord', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          // Immediately set verified state
          setDiscordVerified(true);
          
          // Also refresh status from API to ensure consistency
          // Add a small delay to allow DB write to complete
          setTimeout(async () => {
            try {
              setIsCheckingDiscord(true);
              if (onCheckingChange) {
                onCheckingChange(true);
              }
              const statusResponse = await fetch(`/api/verify-discord-status?address=${address}`);
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                if (statusData.success && statusData.data) {
                  setDiscordVerified(statusData.data.verified || false);
                }
              }
            } catch (error) {
              console.error('Failed to refresh Discord status:', error);
            } finally {
              setIsCheckingDiscord(false);
              if (onCheckingChange) {
                onCheckingChange(false);
              }
            }
          }, 500);
        } else {
          setIsCheckingDiscord(false);
          if (onCheckingChange) {
            onCheckingChange(false);
          }
        }
      } else {
        setIsCheckingDiscord(false);
        if (onCheckingChange) {
          onCheckingChange(false);
        }
      }
    } catch (error) {
      console.error('Failed to link Discord account:', error);
      setIsCheckingDiscord(false);
      if (onCheckingChange) {
        onCheckingChange(false);
      }
    }
  };

  // Check Discord verification status from API
  useEffect(() => {
    if (!address) return;

    const checkDiscordStatus = async () => {
      setIsCheckingDiscord(true);
      if (onCheckingChange) {
        onCheckingChange(true);
      }
      try {
        const response = await fetch(`/api/verify-discord-status?address=${address}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setDiscordVerified(data.data.verified || false);
            
            // If there's a pending verification, link it
            if (data.data.pendingVerification && address) {
              await linkDiscordAccount();
            }
          }
        }
      } catch (error) {
        console.error('Failed to check Discord status:', error);
      } finally {
        setIsCheckingDiscord(false);
        if (onCheckingChange) {
          onCheckingChange(false);
        }
      }
    };

    checkDiscordStatus();
  }, [address, onCheckingChange]);

  // Handle OAuth callback
  useEffect(() => {
    const discordSuccess = searchParams?.get('discord_success');
    const discordError = searchParams?.get('discord_error');

    if (discordSuccess === '1' && address) {
      // Link Discord account to wallet
      // This will update discordVerified state when complete
      linkDiscordAccount().then(() => {
        // After linking, refresh the status check to ensure it's up to date
        // This ensures the parent component gets the updated state
        const checkStatus = async () => {
          setIsCheckingDiscord(true);
          if (onCheckingChange) {
            onCheckingChange(true);
          }
          try {
            const response = await fetch(`/api/verify-discord-status?address=${address}`);
            if (response.ok) {
              const data = await response.json();
              if (data.success && data.data) {
                setDiscordVerified(data.data.verified || false);
              }
            }
          } catch (error) {
            console.error('Failed to check Discord status after linking:', error);
          } finally {
            setIsCheckingDiscord(false);
            if (onCheckingChange) {
              onCheckingChange(false);
            }
          }
        };
        
        // Wait a bit for DB write to complete, then check status
        setTimeout(checkStatus, 1000);
      });
    }

    if (discordError) {
      // Error will be handled by the claim page toast notification
      // This is just for logging
      console.error('Discord OAuth error:', discordError);
    }
  }, [searchParams, address, onCheckingChange]);

  // Load Twitter verification from localStorage (keep existing method)
  useEffect(() => {
    if (!address) return;

    const storageKey = `social_verification_${address.toLowerCase()}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setTwitterVisited(data.twitterVisited || false);
      } catch {
        // Ignore parse errors
      }
    }
  }, [address]);

  // Notify parent when verification changes
  useEffect(() => {
    if (onVerificationChange) {
      onVerificationChange(discordVerified, twitterVisited);
    }
  }, [discordVerified, twitterVisited, onVerificationChange]);

  const handleDiscordClick = () => {
    // Directly start the Discord OAuth flow
    window.location.href = '/api/auth/discord';
  };

  const handleTwitterClick = () => {
    // Open Twitter link in new tab
    window.open(TWITTER_LINK, '_blank', 'noopener,noreferrer');
    
    // Mark as visited
    setTwitterVisited(true);
    
    // Save to localStorage
    if (address) {
      const storageKey = `social_verification_${address.toLowerCase()}`;
      const current = localStorage.getItem(storageKey);
      const data = current ? JSON.parse(current) : {};
      localStorage.setItem(storageKey, JSON.stringify({
        ...data,
        twitterVisited: true,
      }));
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-slate-300 text-sm sm:text-base mb-2">
          {t('title')}
        </p>
        <div className="flex items-center justify-center gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-1">
            <span className={twitterVisited ? 'text-green-400' : 'text-slate-400'}>
              {t('followX')}: {twitterVisited ? t('verified') : t('notVerified')}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className={discordVerified ? 'text-green-400' : 'text-slate-400'}>
              {t('joinDiscord')}: {discordVerified ? t('verified') : t('notVerified')}
            </span>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Discord Button */}
        <button
          onClick={handleDiscordClick}
          disabled={discordVerified || isCheckingDiscord}
          className={`w-full p-4 rounded-xl border-2 transition-all duration-300 ${
            discordVerified
              ? 'bg-green-500/20 border-green-400/50 cursor-default'
              : 'bg-slate-700/50 border-slate-600 hover:border-blue-400 hover:bg-slate-700/70 cursor-pointer transform hover:scale-105'
          }`}
        >
          <div className="flex items-center justify-center space-x-3">
            {isCheckingDiscord ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-300 border-t-transparent"></div>
                <span className="text-slate-300 font-semibold">{t('checking')}</span>
              </>
            ) : discordVerified ? (
              <>
                <CheckCircledIcon className="w-6 h-6 text-green-400" />
                <span className="text-green-400 font-semibold">{t('verified')}</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.007-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span className="text-slate-300 font-semibold">{t('joinDiscordButton')}</span>
              </>
            )}
          </div>
        </button>

        {/* Twitter/X Button */}
        <button
          onClick={handleTwitterClick}
          disabled={twitterVisited}
          className={`w-full p-4 rounded-xl border-2 transition-all duration-300 ${
            twitterVisited
              ? 'bg-green-500/20 border-green-400/50 cursor-default'
              : 'bg-slate-700/50 border-slate-600 hover:border-blue-400 hover:bg-slate-700/70 cursor-pointer transform hover:scale-105'
          }`}
        >
          <div className="flex items-center justify-center space-x-3">
            {twitterVisited ? (
              <>
                <CheckCircledIcon className="w-6 h-6 text-green-400" />
                <span className="text-green-400 font-semibold">{t('followingX')}</span>
              </>
            ) : (
              <>
                <svg className="w-6 h-6 text-slate-300" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                <span className="text-slate-300 font-semibold">{t('followNow')}</span>
              </>
            )}
          </div>
        </button>
      </div>
      
      {(!discordVerified || !twitterVisited) && (
        <div className="mt-4 text-center">
          <button
            onClick={() => {
              if (!discordVerified) {
                handleDiscordClick();
              }
              if (!twitterVisited) {
                window.open(TWITTER_LINK, '_blank', 'noopener,noreferrer');
              }
            }}
            className="text-xs sm:text-sm text-blue-400 hover:text-blue-300 underline"
          >
            {t('verifyAgain')}
          </button>
        </div>
      )}

      <div className="text-center text-xs text-slate-400">
        Need to join first? <button onClick={() => window.open(DISCORD_LINK, '_blank', 'noopener,noreferrer')} className="text-blue-400 hover:text-blue-300 underline">Join Discord</button>
      </div>
    </div>
  );
}

