'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Target,
  PieChart,
  Download,
  Calendar,
  AlertCircle,
  CheckCircle,
  Coins,
  ShoppingCart
} from 'lucide-react';

interface EarningsData {
  ownPosts: {
    submitted: number;
    approved: number;
    m1Achieved: number;
    m2Achieved: number;
    m3Achieved: number;
    totalReward: number;
  };
  ownConversions: {
    clicks: number;
    mints: number;
    conversionRate: number;
    commission: number;
    purchaseReferrals?: number;
    purchaseCommission?: number;
  };
  overrides: {
    l1Commission: number;
    l2Commission: number;
  };
  earnings: {
    total: number;
    immediate: number;
    vested: number;
  };
}

interface PayoutData {
  accrued: number;
  claimable: number;
  vested: number;
  pendingRequests: Array<{
    id: string;
    amount: number;
    status: string;
    requestedAt: Date;
  }>;
}

interface EarningsBreakdownProps {
  currentPeriod: EarningsData;
  payouts: PayoutData;
  tier: 'pioneer' | 'ambassador' | 'partner';
}

export function EarningsBreakdown({ currentPeriod, payouts, tier }: EarningsBreakdownProps) {
  const [selectedTab, setSelectedTab] = useState<'current' | 'payouts' | 'history'>('current');
  
  const formatCurrency = (amount: number) => {
    // Handle very small amounts that might be in scientific notation
    // Also handle cases where amount might be a very small positive number
    const numAmount = Number(amount) || 0;
    
    if (numAmount > 0 && numAmount < 0.01) {
      // For very small amounts, show more decimal places (up to 8)
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 8
      }).format(numAmount);
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numAmount);
  };
  
  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };
  
  const getTierCommission = (tier: string) => {
    switch (tier) {
      case 'pioneer': return { direct: '10%', l1: '5%', l2: '0%' };
      case 'ambassador': return { direct: '20%', l1: '10%', l2: '5%' };
      case 'partner': return { direct: '40%', l1: '20%', l2: '10%' };
      default: return { direct: '0%', l1: '0%', l2: '0%' };
    }
  };
  
  const commissionRates = getTierCommission(tier);
  const totalEarnings = currentPeriod.earnings.total;
  const totalOverrides = currentPeriod.overrides.l1Commission + currentPeriod.overrides.l2Commission;
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">Earnings Breakdown</h2>
          <p className="text-primary/70">Track your performance and rewards for this period</p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button variant="outline" size="sm">
            <Calendar className="h-4 w-4 mr-2" />
            Period
          </Button>
        </div>
      </div>
      
      {/* Tabs */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
        <Button
          variant={selectedTab === 'current' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedTab('current')}
          className="flex-1"
        >
          Current Period
        </Button>
        <Button
          variant={selectedTab === 'payouts' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedTab('payouts')}
          className="flex-1"
        >
          Payouts
        </Button>
        <Button
          variant={selectedTab === 'history' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setSelectedTab('history')}
          className="flex-1"
        >
          History
        </Button>
      </div>
      
      {/* Current Period Tab */}
      {selectedTab === 'current' && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-800">{formatCurrency(totalEarnings)}</p>
                    <p className="text-sm text-green-600">Total Earnings</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Target className="h-6 w-6 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(currentPeriod.ownPosts.totalReward)}</p>
                    <p className="text-sm text-primary/70">Post Rewards</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Coins className="h-6 w-6 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(currentPeriod.ownConversions.commission || 0)}</p>
                    <p className="text-sm text-primary/70">Mint Commission</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-2 border-orange-200 bg-orange-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <ShoppingCart className="h-6 w-6 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold text-orange-800">
                      {formatCurrency(Number(currentPeriod.ownConversions.purchaseCommission) || 0)}
                    </p>
                    <p className="text-sm text-orange-600">
                      Purchase Referrals ({currentPeriod.ownConversions.purchaseReferrals || 0})
                    </p>
                  </div> 
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-6 w-6 text-orange-500" />
                  <div>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(totalOverrides)}</p>
                    <p className="text-sm text-primary/70">Team Overrides</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Post Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5" />
                  <span>Post Performance</span>
                </CardTitle>
                <CardDescription>Milestone achievements and rewards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-primary">{currentPeriod.ownPosts.submitted}</p>
                    <p className="text-sm text-primary/70">Posts Submitted</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{currentPeriod.ownPosts.approved}</p>
                    <p className="text-sm text-green-600">Approved</p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-yellow-500 text-white">M1</Badge>
                      <span className="text-sm font-medium">25% Milestone</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-yellow-700">{currentPeriod.ownPosts.m1Achieved}</p>
                      <p className="text-xs text-yellow-600">Achieved</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-blue-500 text-white">M2</Badge>
                      <span className="text-sm font-medium">100% Milestone</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-700">{currentPeriod.ownPosts.m2Achieved}</p>
                      <p className="text-xs text-blue-600">Achieved</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-purple-500 text-white">M3</Badge>
                      <span className="text-sm font-medium">Conversion Bonus</span>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-700">{currentPeriod.ownPosts.m3Achieved}</p>
                      <p className="text-xs text-purple-600">Achieved</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Commission Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="h-5 w-5" />
                  <span>Commission Breakdown</span>
                </CardTitle>
                <CardDescription>Your earning sources and rates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div>
                      <p className="font-medium text-green-800">Direct Mints</p>
                      <p className="text-sm text-green-600">{commissionRates.direct} commission</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-green-700">{formatCurrency(currentPeriod.ownConversions.commission || 0)}</p>
                      <p className="text-xs text-green-600">{currentPeriod.ownConversions.mints} mints</p>
                    </div>
                  </div>
                  
                  {((Number(currentPeriod.ownConversions.purchaseCommission) || 0) > 0 || (currentPeriod.ownConversions.purchaseReferrals || 0) > 0) && (
                    <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                      <div>
                        <p className="font-medium text-orange-800">Purchase Referrals</p>
                        <p className="text-sm text-orange-600">
                          {tier === 'partner' ? '2%' : tier === 'ambassador' ? '1%' : '0%'} commission
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-orange-700">
                          {formatCurrency(Number(currentPeriod.ownConversions.purchaseCommission) || 0)}
                        </p>
                        <p className="text-xs text-orange-600">
                          {currentPeriod.ownConversions.purchaseReferrals || 0} purchases
                        </p>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="font-medium text-blue-800">L1 Override</p>
                      <p className="text-sm text-blue-600">{commissionRates.l1} of team mints</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-blue-700">{formatCurrency(currentPeriod.overrides.l1Commission)}</p>
                      <p className="text-xs text-blue-600">From L1 team</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div>
                      <p className="font-medium text-purple-800">L2 Override</p>
                      <p className="text-sm text-purple-600">{commissionRates.l2} of grandteam mints</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-purple-700">{formatCurrency(currentPeriod.overrides.l2Commission)}</p>
                      <p className="text-xs text-purple-600">From L2 team</p>
                    </div>
                  </div>
                </div>
                
                <div className="pt-3 border-t">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-primary">Conversion Rate</span>
                    <span className="font-bold text-primary">
                      {formatPercentage(currentPeriod.ownConversions.conversionRate)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Settlement Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-5 w-5" />
                <span>Settlement Breakdown</span>
              </CardTitle>
              <CardDescription>40% immediate, 60% vests over 90 days</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(currentPeriod.earnings.immediate)}</p>
                  <p className="text-sm text-green-600">Immediate (40%)</p>
                  <p className="text-xs text-green-500 mt-1">Available now</p>
                </div>
                
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{formatCurrency(currentPeriod.earnings.vested)}</p>
                  <p className="text-sm text-blue-600">Vested (60%)</p>
                  <p className="text-xs text-blue-500 mt-1">Over 90 days</p>
                </div>
                
                <div className="text-center p-4 bg-primary/10 rounded-lg">
                  <p className="text-2xl font-bold text-primary">{formatCurrency(currentPeriod.earnings.total)}</p>
                  <p className="text-sm text-primary/70">Total Earned</p>
                  <p className="text-xs text-primary/50 mt-1">This period</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Payouts Tab */}
      {selectedTab === 'payouts' && (
        <div className="space-y-6">
          {/* Payout Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-2 border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                  <div>
                    <p className="text-2xl font-bold text-green-800">{formatCurrency(payouts.claimable)}</p>
                    <p className="text-sm text-green-600">Claimable Now</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Clock className="h-6 w-6 text-blue-500" />
                  <div>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(payouts.vested)}</p>
                    <p className="text-sm text-primary/70">Still Vesting</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <DollarSign className="h-6 w-6 text-purple-500" />
                  <div>
                    <p className="text-2xl font-bold text-primary">{formatCurrency(payouts.accrued)}</p>
                    <p className="text-sm text-primary/70">Total Accrued</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Pending Requests */}
          <Card>
            <CardHeader>
              <CardTitle>Pending Payout Requests</CardTitle>
              <CardDescription>Track your withdrawal requests</CardDescription>
            </CardHeader>
            <CardContent>
              {payouts.pendingRequests.length === 0 ? (
                <div className="text-center py-8 text-primary/70">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-primary/30" />
                  <p className="text-lg font-medium">No pending requests</p>
                  <p className="text-sm">Request a withdrawal to see it here</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payouts.pendingRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium text-primary">{formatCurrency(request.amount)}</p>
                        <p className="text-sm text-primary/70">
                          Requested {new Date(request.requestedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                        {request.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Request Withdrawal */}
          <Card>
            <CardHeader>
              <CardTitle>Request Withdrawal</CardTitle>
              <CardDescription>Withdraw your claimable earnings</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded-lg">
                <div>
                  <p className="font-medium text-primary">Available to withdraw</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(payouts.claimable)}</p>
                </div>
                <Button disabled={payouts.claimable <= 0}>
                  Request Withdrawal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* History Tab */}
      {selectedTab === 'history' && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Earnings History</CardTitle>
              <CardDescription>Historical performance data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-primary/70">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-primary/30" />
                <p className="text-lg font-medium">History coming soon</p>
                <p className="text-sm">Historical data will be available here</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
