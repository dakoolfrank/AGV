"use client";

import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Copy, 
  Share2, 
  UserPlus, 
  TrendingUp, 
  BarChart3, 
  Zap,
  CheckCircle,
  ExternalLink
} from "lucide-react";

interface ReferralStats {
  totalReferrals: number;
  tier1Rewards: number;
  tier2Rewards: number;
  totalEarnings: number;
}

interface ReferralSystemProps {
  userId?: string;
  referralCode?: string;
}

export const ReferralSystem: React.FC<ReferralSystemProps> = ({ 
  userId = "user123", 
  referralCode = "G3-REF-ABC123" 
}) => {
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    tier1Rewards: 0,
    tier2Rewards: 0,
    totalEarnings: 0
  });

  const [copied, setCopied] = useState<string | null>(null);

  const referralLink = `https://g3fund.com/join?ref=${referralCode}`;

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const shareReferral = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join G3 Fund Community',
        text: 'Join the first RWA-native KOL incubation fund and start earning rewards!',
        url: referralLink
      });
    } else {
      copyToClipboard(referralLink, 'link');
    }
  };

  const commissionRates = [
    {
      tier: "Small KOL",
      tier1Rate: "15%",
      tier2Rate: "5%",
      tier1Reward: "$50-200",
      tier2Reward: "$15-65"
    },
    {
      tier: "Tier-1 KOL",
      tier1Rate: "15%",
      tier2Rate: "5%",
      tier1Reward: "$200-500",
      tier2Reward: "$65-165"
    },
    {
      tier: "Partner KOL",
      tier1Rate: "15%",
      tier2Rate: "5%",
      tier1Reward: "$500-1000",
      tier2Reward: "$165-330"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Referral Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <UserPlus className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{stats.totalReferrals}</div>
            <div className="text-sm text-gray-600">Total Referrals</div>
            <div className="text-sm font-semibold text-gray-800 mt-2">Your Referrals</div>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-gray-900">${stats.tier1Rewards}</div>
            <div className="text-sm text-gray-600">Tier 1 Rewards</div>
            <div className="text-sm font-semibold text-gray-800 mt-2">Direct Referrals</div>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-gray-900">${stats.tier2Rewards}</div>
            <div className="text-sm text-gray-600">Tier 2 Rewards</div>
            <div className="text-sm font-semibold text-gray-800 mt-2">Indirect Referrals</div>
          </CardContent>
        </Card>

        <Card className="text-center">
          <CardContent className="pt-6">
            <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4">
              <Zap className="h-6 w-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-gray-900">${stats.totalEarnings}</div>
            <div className="text-sm text-gray-600">Total Earnings</div>
            <div className="text-sm font-semibold text-gray-800 mt-2">All-time Income</div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Link Generator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Share2 className="h-6 w-6 mr-2 text-primary" />
            Your Referral Link
          </CardTitle>
          <CardDescription>
            Share this link to earn rewards when people join through your referral
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Your Referral Code</label>
            <div className="flex space-x-2">
              <Input 
                value={referralCode} 
                readOnly 
                className="bg-gray-50"
              />
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => copyToClipboard(referralCode, 'code')}
              >
                {copied === 'code' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Referral Link</label>
            <div className="flex space-x-2">
              <Input 
                value={referralLink} 
                readOnly 
                className="bg-gray-50"
              />
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => copyToClipboard(referralLink, 'link')}
              >
                {copied === 'link' ? <CheckCircle className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <Button 
              className="flex-1"
              onClick={shareReferral}
            >
              <Share2 className="h-4 w-4 mr-2" />
              Share Referral Link
            </Button>
            <Button 
              variant="outline"
              onClick={() => window.open('/coming-soon', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Analytics
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Commission Structure */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <BarChart3 className="h-6 w-6 mr-2 text-primary" />
            Commission Structure
          </CardTitle>
          <CardDescription>
            Transparent 2-tier referral system with competitive commission rates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {commissionRates.map((rate, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-800">{rate.tier}</h4>
                  <Badge variant="outline" className="text-primary border-primary">
                    {rate.tier1Rate} / {rate.tier2Rate}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <div className="text-sm text-gray-600">Tier 1 (Direct Referral)</div>
                    <div className="font-semibold text-green-600">{rate.tier1Reward}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-sm text-gray-600">Tier 2 (Indirect Referral)</div>
                    <div className="font-semibold text-purple-600">{rate.tier2Reward}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CheckCircle className="h-6 w-6 mr-2 text-primary" />
            How the Referral System Works
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">1</div>
              <div>
                <h4 className="font-semibold text-gray-800">Share Your Link</h4>
                <p className="text-sm text-gray-600">Share your unique referral link with potential community members</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">2</div>
              <div>
                <h4 className="font-semibold text-gray-800">They Join</h4>
                <p className="text-sm text-gray-600">When someone joins through your link, they become your Tier 1 referral</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">3</div>
              <div>
                <h4 className="font-semibold text-gray-800">Earn Tier 1 Rewards</h4>
                <p className="text-sm text-gray-600">You earn 15% commission on their activities and achievements</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-white text-sm font-bold">4</div>
              <div>
                <h4 className="font-semibold text-gray-800">Earn Tier 2 Rewards</h4>
                <p className="text-sm text-gray-600">When your referrals bring others, you earn 5% on their activities too</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
