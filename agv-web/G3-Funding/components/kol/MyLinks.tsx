'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, ExternalLink, Share2, Users, Coins, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

interface MyLinksProps {
  refCode: string;
  tier: 'pioneer' | 'ambassador' | 'partner';
}

export function MyLinks({ refCode, tier }: MyLinksProps) {
  const [copiedLink, setCopiedLink] = useState<string | null>(null);
  
  const userMintLink = `https://agvprotocol.org/mint/${refCode}`;
  const kolRecruitLink = `https://g3fund.org/contributor-application?ref=${refCode}`;
  const userBuyLink = `https://buy.agvnexrur.ai/buy/${refCode}`;
  
  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedLink(type);
      toast.success(`${type} link copied to clipboard!`);
      
      setTimeout(() => setCopiedLink(null), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };
  
  const shareLink = async (url: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          url,
          text: `Join me in the G3 Social Mining program! ${title}`
        });
      } catch {
        // User cancelled or error occurred
        copyToClipboard(url, title);
      }
    } else {
      copyToClipboard(url, title);
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
  
  const getTierCommission = (tier: string) => {
    switch (tier) {
      case 'pioneer': return '10%';
      case 'ambassador': return '20%';
      case 'partner': return '40%';
      default: return '0%';
    }
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-primary">My Referral Links</h2>
          <p className="text-primary/70">Share these links to earn commissions and build your team</p>
        </div>
        <Badge className={`${getTierColor(tier)} text-white`}>
          {tier.charAt(0).toUpperCase() + tier.slice(1)} • {getTierCommission(tier)} Commission
        </Badge>
      </div>
      
      {/* User Mint Link */}
      <Card className="border-2 border-green-200 bg-green-50">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <Coins className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-green-800">User Mint Link</CardTitle>
              <CardDescription className="text-green-600">
                Share with users to earn {getTierCommission(tier)} commission on their mints
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-white rounded-lg border border-green-200">
            <code className="text-sm text-green-700 break-all">{userMintLink}</code>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => copyToClipboard(userMintLink, 'User Mint')}
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-100"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copiedLink === 'User Mint' ? 'Copied!' : 'Copy Link'}
            </Button>
            
            <Button
              onClick={() => shareLink(userMintLink, 'G3 Mint Link')}
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-100"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            
            <Button
              onClick={() => window.open(userMintLink, '_blank')}
              variant="outline"
              size="sm"
              className="border-green-300 text-green-700 hover:bg-green-100"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
          
          <div className="text-sm text-green-600">
            <p><strong>How it works:</strong> When users mint through this link, you earn {getTierCommission(tier)} commission on their mint value.</p>
          </div>
        </CardContent>
      </Card>
      
      {/* KOL Recruitment Link */}
      <Card className="border-2 border-blue-200 bg-blue-50">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-blue-800">KOL Recruitment Link</CardTitle>
              <CardDescription className="text-blue-600">
                Invite KOLs to join your team and earn override commissions
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-white rounded-lg border border-blue-200">
            <code className="text-sm text-blue-700 break-all">{kolRecruitLink}</code>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => copyToClipboard(kolRecruitLink, 'KOL Recruitment')}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copiedLink === 'KOL Recruitment' ? 'Copied!' : 'Copy Link'}
            </Button>
            
            <Button
              onClick={() => shareLink(kolRecruitLink, 'Join My G3 Team')}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            
            <Button
              onClick={() => window.open(kolRecruitLink, '_blank')}
              variant="outline"
              size="sm"
              className="border-blue-300 text-blue-700 hover:bg-blue-100"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
          
          <div className="text-sm text-blue-600 space-y-2">
            <p><strong>Team Earnings:</strong></p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>L1 Override: {tier === 'pioneer' ? '5%' : tier === 'ambassador' ? '10%' : '20%'} of their mint commissions</li>
              <li>L2 Override: {tier === 'pioneer' ? '0%' : tier === 'ambassador' ? '5%' : '10%'} of grandchildren commissions</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* User Buy Link */}
      <Card className="border-2 border-purple-200 bg-purple-50">
        <CardHeader>
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center">
              <ShoppingCart className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg text-purple-800">User Buy Link</CardTitle>
              <CardDescription className="text-purple-600">
                Share with users to earn {getTierCommission(tier)} commission on their token purchases
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-white rounded-lg border border-purple-200">
            <code className="text-sm text-purple-700 break-all">{userBuyLink}</code>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => copyToClipboard(userBuyLink, 'User Buy')}
              variant="outline"
              size="sm"
              className="border-purple-300 text-purple-700 hover:bg-purple-100"
            >
              <Copy className="h-4 w-4 mr-2" />
              {copiedLink === 'User Buy' ? 'Copied!' : 'Copy Link'}
            </Button>
            
            <Button
              onClick={() => shareLink(userBuyLink, 'G3 Buy Link')}
              variant="outline"
              size="sm"
              className="border-purple-300 text-purple-700 hover:bg-purple-100"
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
            
            <Button
              onClick={() => window.open(userBuyLink, '_blank')}
              variant="outline"
              size="sm"
              className="border-purple-300 text-purple-700 hover:bg-purple-100"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Preview
            </Button>
          </div>
          
          <div className="text-sm text-purple-600">
            <p><strong>How it works:</strong> When users buy tokens through this link, you earn {getTierCommission(tier)} commission on their purchase value.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
