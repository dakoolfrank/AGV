'use client';

import { useState, useEffect } from 'react';
import { useActiveAccount } from 'thirdweb/react';
import { PageLayout } from '@/components/layouts/PageLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageCard } from '@/components/ui/PageCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { WalletConnect } from '@/components/WalletConnect';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CampaignStats {
  currentCount: number;
  maxCount: number;
  isLimitReached: boolean;
}

export default function CampaignPage() {
  const account = useActiveAccount();
  const address = account?.address;
  
  const [xUsername, setXUsername] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [isCampaignClosed] = useState(true); // Campaign is closed

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setIsLoadingStats(true);
      const response = await fetch('/api/campaign/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!address) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!xUsername.trim() || !discordUsername.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/campaign/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: address,
          xUsername: xUsername.trim(),
          discordUsername: discordUsername.trim(),
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Submission successful!');
        setXUsername('');
        setDiscordUsername('');
        // Refresh stats
        fetchStats();
      } else {
        toast.error(data.error || 'Failed to submit');
      }
    } catch (error) {
      console.error('Error submitting:', error);
      toast.error('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  let remainingSlots = stats ? stats.maxCount - stats.currentCount : 0;
  remainingSlots -= 792;
  const isLimitReached = stats?.isLimitReached || isCampaignClosed || false;

  return (
    <PageLayout>
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <PageHeader
            title="Batch III Activation"
            description="Join our campaign by filling out your details below"
          />

          {/* Stats Card */}
          {/* {!isLoadingStats && stats && !stats.isLimitReached && (
            <Card className="mb-6 border-blue-500/30 bg-blue-500/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Submissions</p>
                    <p className="text-2xl font-bold">
                      {stats.currentCount + 792} / 1000
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">{remainingSlots} slots remaining</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )} */}

          <PageCard>
            <CardHeader>
              <CardTitle>Campaign Registration Form</CardTitle>
              <CardDescription>
                Fill in your details to participate in the campaign. Make sure all information is correct.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isCampaignClosed ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-red-400" />
                    <p className="text-sm text-red-400 font-medium">
                      The campaign form is now closed. No new submissions are being accepted.
                    </p>
                  </div>
                </div>
              ) : !address ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-amber-400">
                    <AlertTriangle className="h-5 w-5" />
                    <p className="text-sm">Please connect your wallet to continue</p>
                  </div>
                  <div className="flex justify-center py-4">
                    <WalletConnect />
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Wallet Address Field (Read-only) */}
                  <div className="space-y-2">
                    <label htmlFor="walletAddress" className="text-sm font-medium">
                      Wallet Address
                    </label>
                    <Input
                      id="walletAddress"
                      type="text"
                      value={address}
                      readOnly
                      disabled
                      className="bg-muted/50 cursor-not-allowed font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is your connected wallet address
                    </p>
                  </div>

                  {/* X Username Field */}
                  <div className="space-y-2">
                    <label htmlFor="xUsername" className="text-sm font-medium">
                      X Username <span className="text-red-400">*</span>
                    </label>
                    <Input
                      id="xUsername"
                      type="text"
                      placeholder="Enter your X (Twitter) username"
                      value={xUsername}
                      onChange={(e) => setXUsername(e.target.value)}
                      required
                      disabled={isSubmitting || isLimitReached}
                      className="font-mono"
                    />
                  </div>

                  {/* Discord Username Field */}
                  <div className="space-y-2">
                    <label htmlFor="discordUsername" className="text-sm font-medium">
                      Discord Username <span className="text-red-400">*</span>
                    </label>
                    <Input
                      id="discordUsername"
                      type="text"
                      placeholder="Enter your Discord username"
                      value={discordUsername}
                      onChange={(e) => setDiscordUsername(e.target.value)}
                      required
                      disabled={isSubmitting || isLimitReached}
                      className="font-mono"
                    />
                  </div>

                  {isLimitReached && (
                    <div className="flex items-center gap-2 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                      <p className="text-sm text-red-400">
                        The submission limit has been reached. No more submissions are being accepted.
                      </p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting || isLimitReached || !xUsername.trim() || !discordUsername.trim()}
                    className="w-full"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit'
                    )}
                  </Button>
                </form>
              )}
            </CardContent>
          </PageCard>

          {/* Info Card */}
          <Card className="mt-6 border-blue-500/30 bg-blue-500/5">
            <CardHeader>
              <CardTitle className="text-lg">Important Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• Your wallet address is automatically filled from your connected wallet</p>
              <p>• Previously whitelisted wallets are automatically filtered out</p>
              <p>• Only 1000 submissions will be accepted</p>
              <p>• Each wallet address can only submit once</p>
              <p>• Make sure all information is accurate before submitting</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PageLayout>
  );
}

