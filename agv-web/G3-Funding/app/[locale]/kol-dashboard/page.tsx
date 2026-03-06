'use client';

import React, { useEffect, useState } from 'react';
import { MyLinks } from '@/components/kol/MyLinks';
import { TeamTable } from '@/components/kol/TeamTable';
import { EarningsBreakdown } from '@/components/kol/EarningsBreakdown';
import { GlobalMintCounter } from '@/components/kol/GlobalMintCounter';
import { VestingSchedule } from '@/components/kol/VestingSchedule';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  User, 
  Link2, 
  Users, 
  DollarSign, 
  Shield,
  TrendingUp,
  RefreshCw,
  Wallet,
  Lock
} from 'lucide-react';
import { KOLDashboardData, KOLProfile } from '@/lib/types';
import { KOLAuthWrapper } from '@/components/auth/kol-auth-wrapper';
import { useAuth } from '@/lib/auth-context';
import { useTranslations } from '../TranslationProvider';
import { useAddress, useConnect, useDisconnect, metamaskWallet } from '@thirdweb-dev/react';

function KOLDashboardContent() {
  const t = useTranslations();
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<KOLDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  
  // Wallet connection
  const address = useAddress();
  const connect = useConnect();
  const disconnect = useDisconnect();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnectWallet = async () => {
    try {
      setIsConnecting(true);
      const metamaskConfig = metamaskWallet();
      await connect(metamaskConfig);
    } catch {
      // Connection failed - user will see error from thirdweb
    } finally {
      setIsConnecting(false);
    }
  };
  
  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!user?.email) {
        setError(t('kolDashboard.userNotAuthenticated'));
        setLoading(false);
        return;
      }

      try {
        // Get the current user's KOL profile to fetch real data
        const response = await fetch('/api/kol/me/overview', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-user-email': user.email,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error(t('kolDashboard.authenticationRequired'));
          } else if (response.status === 404) {
            throw new Error(t('kolDashboard.kolProfileNotFound'));
          } else {
            throw new Error(t('kolDashboard.failedToFetchData').replace('{error}', response.statusText));
          }
        }

        const data = await response.json();
        setDashboardData(data);
      } catch (err) {
        // Error fetching dashboard data
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to mock data for development
        setDashboardData(getMockDashboardData());
      } finally {
        setLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [user, t]);

  const refreshData = async () => {
    setRefreshing(true);
    try {
      if (!user?.email) {
        setError(t('kolDashboard.userNotAuthenticated'));
        return;
      }

      const response = await fetch('/api/kol/me/overview', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-user-email': user.email,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(t('kolDashboard.authenticationRequired'));
        } else if (response.status === 404) {
          throw new Error(t('kolDashboard.kolProfileNotFound'));
        } else {
          throw new Error(t('kolDashboard.failedToFetchData').replace('{error}', response.statusText));
        }
      }

      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      // Error refreshing dashboard data
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setRefreshing(false);
    }
  };
  
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'pioneer': return 'bg-green-500';
      case 'ambassador': return 'bg-blue-500';
      case 'partner': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
        <div className="h-96 bg-gray-200 rounded"></div>
      </div>
    );
  }
  
  if (error && !dashboardData) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-bold text-red-800 mb-2">{t('kolDashboard.dashboardUnavailable')}</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={refreshData} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? t('kolDashboard.refreshing') : t('kolDashboard.tryAgain')}
            </Button>
            <Button variant="outline" onClick={() => window.location.reload()}>
              {t('kolDashboard.reloadPage')}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!dashboardData) return null;
  
  // Check if user is an agent
  const profileData = dashboardData.profile as KOLProfile & {
    role?: string;
    type?: string;
    agentType?: string;
    agentLevel?: number;
    sGVTBalance?: number;
  };
  const isAgent = 
    profileData.role === 'agent' || 
    profileData.type === 'agent' || 
    profileData.agentType !== undefined || // Set by agv-protocol-app
    profileData.agentLevel !== undefined || // Set by agv-protocol-app
    profileData.sGVTBalance !== undefined;
  
  return (
    <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between mb-8">
          <div className="flex items-center space-x-4 mb-4 lg:mb-0">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-primary">
                {t('kolDashboard.welcomeBack').replace('{name}', dashboardData.profile.displayName)}
              </h1>
              <div className="flex items-center space-x-2 mt-1 flex-wrap gap-2">
                {!isAgent && (
                  <Badge className={`${getTierColor(dashboardData.profile.tier)} text-white`}>
                    {dashboardData.profile.tier.charAt(0).toUpperCase() + dashboardData.profile.tier.slice(1)}
                  </Badge>
                )}
                <Badge variant="outline" className={getStatusColor(dashboardData.profile.status)}>
                  {dashboardData.profile.status}
                </Badge>
                {profileData.sGVTBalance !== undefined && (
                  <Badge variant="outline" className="bg-purple-50 border-purple-200 text-purple-700">
                    <span className="font-mono">{profileData.sGVTBalance?.toLocaleString() || 0} sGVT</span>
                    {/* <span className="ml-1 text-xs text-purple-500">(Display Only)</span> */}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('https://zealy.io/cw/ideezainnovatorshub/invite/WVXO1xizilCy_EJnRb59V', '_blank')}
              className="flex items-center space-x-2 border-2 border-primary text-primary hover:bg-primary hover:text-white transition-all duration-300"
            >
              <span>{t('kolDashboard.joinZealy')}</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={refreshData}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? t('kolDashboard.refreshing') : t('kolDashboard.refresh')}
            </Button>
          </div>
        </div>
        
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-800">
                    ${dashboardData.currentPeriod.earnings.total.toFixed(0)}
                  </p>
                  <p className="text-sm text-green-600">{t('kolDashboard.totalEarnings')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {dashboardData.currentPeriod.ownPosts.approved}
                  </p>
                  <p className="text-sm text-primary/70">{t('kolDashboard.postsApproved')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Users className="h-6 w-6 text-purple-600" />
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {dashboardData.team.l1KOLs.length + dashboardData.team.l2KOLs.length}
                  </p>
                  <p className="text-sm text-primary/70">{t('kolDashboard.teamMembers')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <GlobalMintCounter campaign="G3" />
        </div>
        
        {/* Main Dashboard Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className={`grid w-full ${isAgent ? 'grid-cols-5' : 'grid-cols-4'} bg-white border border-gray-200 rounded-lg p-1`}>
            <TabsTrigger value="overview" className="flex items-center space-x-2 bg-white text-gray-700 font-semibold py-3 px-6 rounded-md border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 data-[state=active]:border-gray-400 data-[state=active]:bg-gray-50 data-[state=active]:text-gray-800">
              <TrendingUp className="h-5 w-5" />
              <span>{t('kolDashboard.overview')}</span>
            </TabsTrigger>
            <TabsTrigger value="links" className="flex items-center space-x-2 bg-white text-gray-700 font-semibold py-3 px-6 rounded-md border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 data-[state=active]:border-gray-400 data-[state=active]:bg-gray-50 data-[state=active]:text-gray-800">
              <Link2 className="h-5 w-5" />
              <span>{t('kolDashboard.myLinks')}</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center space-x-2 bg-white text-gray-700 font-semibold py-3 px-6 rounded-md border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 data-[state=active]:border-gray-400 data-[state=active]:bg-gray-50 data-[state=active]:text-gray-800">
              <Users className="h-5 w-5" />
              <span>{t('kolDashboard.team')}</span>
            </TabsTrigger>
            <TabsTrigger value="earnings" className="flex items-center space-x-2 bg-white text-gray-700 font-semibold py-3 px-6 rounded-md border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 data-[state=active]:border-gray-400 data-[state=active]:bg-gray-50 data-[state=active]:text-gray-800">
              <DollarSign className="h-5 w-5" />
              <span>{t('kolDashboard.earnings')}</span>
            </TabsTrigger>
            {isAgent && (
              <TabsTrigger value="vesting" className="flex items-center space-x-2 bg-white text-gray-700 font-semibold py-3 px-6 rounded-md border border-gray-300 hover:border-gray-400 hover:bg-gray-50 transition-all duration-200 data-[state=active]:border-gray-400 data-[state=active]:bg-gray-50 data-[state=active]:text-gray-800">
                <Lock className="h-5 w-5" />
                <span>Vesting</span>
              </TabsTrigger>
            )}
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('kolDashboard.performanceSummary')}</CardTitle>
                  <CardDescription>{t('kolDashboard.currentPeriodHighlights')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-xl font-bold text-blue-600">
                        {dashboardData.currentPeriod.ownConversions.mints}
                      </p>
                      <p className="text-sm text-blue-600">{t('kolDashboard.directMints')}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xl font-bold text-green-600">
                        {(dashboardData.currentPeriod.ownConversions.conversionRate * 100).toFixed(1)}%
                      </p>
                      <p className="text-sm text-green-600">{t('kolDashboard.conversionRate')}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">{t('kolDashboard.m1Milestones')}</span>
                      <span className="font-medium">{dashboardData.currentPeriod.ownPosts.m1Achieved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">{t('kolDashboard.m2Milestones')}</span>
                      <span className="font-medium">{dashboardData.currentPeriod.ownPosts.m2Achieved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">{t('kolDashboard.m3Bonuses')}</span>
                      <span className="font-medium">{dashboardData.currentPeriod.ownPosts.m3Achieved}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Compliance Status */}
              <Card>
                <CardHeader>
                  <CardTitle>{t('kolDashboard.complianceStatus')}</CardTitle>
                  <CardDescription>{t('kolDashboard.accountStanding')}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <span className="text-sm font-medium text-green-800">{t('kolDashboard.accountStatus')}</span>
                    <Badge className="bg-green-500 text-white">{t('kolDashboard.active')}</Badge>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">{t('kolDashboard.pendingPosts')}</span>
                      <span className="font-medium">{dashboardData.compliance.pendingPosts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">{t('kolDashboard.approvedPosts')}</span>
                      <span className="font-medium text-green-600">{dashboardData.compliance.approvedPosts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">{t('kolDashboard.strikes')}</span>
                      <span className="font-medium">{dashboardData.compliance.strikes}/3</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="links">
            <MyLinks
              refCode={dashboardData.profile.refCode}
              tier={dashboardData.profile.tier}
            />
          </TabsContent>
          
          <TabsContent value="team">
            <TeamTable
              l1KOLs={dashboardData.team.l1KOLs}
              l2KOLs={dashboardData.team.l2KOLs}
            />
          </TabsContent>
          
          
          <TabsContent value="earnings">
            <EarningsBreakdown
              currentPeriod={dashboardData.currentPeriod}
              payouts={dashboardData.payouts}
              tier={dashboardData.profile.tier}
            />
          </TabsContent>
          
          {isAgent && (
            <TabsContent value="vesting" className="space-y-6">
              {/* Wallet Connection Card */}
              {!address && (
                <Card className="border-blue-200 bg-blue-50">
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Wallet className="h-5 w-5 text-blue-600" />
                      <span>Connect Your Wallet</span>
                    </CardTitle>
                    <CardDescription>
                      Connect your wallet to view your vesting schedule and balance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      onClick={handleConnectWallet}
                      disabled={isConnecting}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isConnecting ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Wallet className="h-4 w-4 mr-2" />
                          Connect Wallet
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              )}
              
              {/* Connected Wallet Info */}
              {address && (
                <Card className="border-green-200 bg-green-50">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Wallet className="h-5 w-5 text-green-600" />
                        <span>Connected Wallet</span>
                      </div>
                      <Badge className="bg-green-500 text-white">Connected</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Address</p>
                        <p className="font-mono text-sm">{address}</p>
                      </div>
                      <Button
                        onClick={() => disconnect()}
                        variant="outline"
                        size="sm"
                      >
                        Disconnect
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
              
              {/* Vesting Schedule */}
              <VestingSchedule walletAddress={address ?? null} />
            </TabsContent>
          )}
        </Tabs>
    </div>
  );
}

// Mock data for demo purposes
function getMockDashboardData(): KOLDashboardData {
  return {
    profile: {
      id: 'mock-kol-123',
      tier: 'ambassador',
      status: 'active',
      refCode: 'KOL123ABC',
      displayName: 'Demo Ambassador',
      email: 'demo@example.com',
      wallet: '0x1234...5678',
      region: ['North America'],
      languages: ['English'],
      socials: [
        {
          platform: 'twitter',
          url: 'https://twitter.com/demo',
          username: 'demo',
          followers: 15000,
          verified: true
        }
      ],
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
      campaign: 'G3'
    },
    currentPeriod: {
      ownPosts: {
        submitted: 8,
        approved: 6,
        m1Achieved: 4,
        m2Achieved: 2,
        m3Achieved: 1,
        totalReward: 350
      },
      ownConversions: {
        clicks: 1250,
        mints: 25,
        conversionRate: 0.02,
        commission: 500
      },
      overrides: {
        l1Commission: 150,
        l2Commission: 75
      },
      earnings: {
        total: 1075,
        immediate: 430,
        vested: 645
      }
    },
    team: {
      l1KOLs: [
        {
          id: 'l1-1',
          displayName: 'Team Member 1',
          tier: 'pioneer',
          status: 'active',
          mints: 15,
          commissionGenerated: 150,
          lastActive: new Date('2024-10-01')
        },
        {
          id: 'l1-2',
          displayName: 'Team Member 2',
          tier: 'ambassador',
          status: 'active',
          mints: 8,
          commissionGenerated: 160,
          lastActive: new Date('2024-09-28')
        }
      ],
      l2KOLs: [
        {
          id: 'l2-1',
          displayName: 'Grand Team 1',
          tier: 'pioneer',
          status: 'active',
          mints: 5,
          commissionGenerated: 50,
          lastActive: new Date('2024-09-30'),
          parentId: 'l1-1'
        }
      ]
    },
    payouts: {
      accrued: 2150,
      claimable: 860,
      vested: 1290,
      pendingRequests: []
    },
    compliance: {
      pendingPosts: 2,
      approvedPosts: 6,
      rejectedPosts: 0,
      strikes: 0
    }
  };
}

export default function KOLDashboardPage() {
  return (
    <KOLAuthWrapper>
      <KOLDashboardContent />
    </KOLAuthWrapper>
  );
}
