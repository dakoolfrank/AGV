"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  ExternalLink, 
  Copy,
  Calendar,
  Mail,
  Wallet,
  DollarSign,
  TrendingUp,
  Shield,
  BarChart3,
  Globe,
  Twitter,
  Youtube,
  Settings,
  Edit,
  Save,
  AlertTriangle,
  ArrowLeft
} from "lucide-react";
import { useTranslations } from "@/hooks/useTranslations";
import { createLocalizedHref } from "@/lib/locale-utils";
import Link from "next/link";

// Types
interface KOL {
  kolId: string;
  name: string;
  walletAddress: string;
  email?: string | null;
  target?: number;
  seed?: number;
  tree?: number;
  solar?: number;
  compute?: number;
  updatedAt?: string | number | Date;
}

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

export default function KOLProfilePage() {
  const params = useParams();
  const { locale } = useTranslations();
  const kolId = params.kolId as string;
  
  const [kol, setKol] = useState<KOL | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch KOL data
  useEffect(() => {
    const fetchKOLData = async () => {
      try {
        setLoading(true);
        
        if (!auth.currentUser) {
          toast.error("Authentication required");
          return;
        }

        const idToken = await auth.currentUser.getIdToken(true);
        const response = await fetch(`/api/admin/kol/${kolId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            toast.error("KOL not found");
          } else if (response.status === 401) {
            toast.error("Authentication required");
          } else {
            toast.error("Failed to load KOL data");
          }
          return;
        }

        const kolData = await response.json();
        setKol(kolData as KOL);
      } catch (error) {
        console.error("Error loading KOL:", error);
        toast.error("Failed to load KOL data");
      } finally {
        setLoading(false);
      }
    };

    if (kolId) {
      fetchKOLData();
    }
  }, [kolId]);

  const copyReferralLink = (kolId: string) => {
    const digits = kolId.match(/\d{6}/)?.[0] || ""
    const localizedMintPath = createLocalizedHref(`/mint/${digits}`, locale)
    const link = `${window.location.origin}${localizedMintPath}`
    navigator.clipboard.writeText(link)
    toast.success("Referral link copied")
  }

  const copyWalletAddress = (address: string) => {
    navigator.clipboard.writeText(address)
    toast.success("Wallet address copied")
  }

  const doSignOut = async () => {
    await auth.signOut();
  };

  if (loading) {
    return (
      <DashboardLayout 
        user={{
          email: auth.currentUser?.email,
          name: auth.currentUser?.displayName,
          avatar: auth.currentUser?.photoURL
        }}
        onSignOut={doSignOut}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <LoadingSpinner size="lg" text="Loading KOL profile..." />
        </div>
      </DashboardLayout>
    );
  }

  if (!kol) {
    return (
      <DashboardLayout 
        user={{
          email: auth.currentUser?.email,
          name: auth.currentUser?.displayName,
          avatar: auth.currentUser?.photoURL
        }}
        onSignOut={doSignOut}
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-red-800 mb-2">KOL Not Found</h2>
            <p className="text-red-600 mb-4">The requested KOL profile could not be found.</p>
            <Link href={createLocalizedHref('/admin/kols', locale)}>
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to KOLs
              </Button>
            </Link>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout 
      user={{
        email: auth.currentUser?.email,
        name: auth.currentUser?.displayName,
        avatar: auth.currentUser?.photoURL
      }}
      onSignOut={doSignOut}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href={createLocalizedHref('/admin/kols', locale)}>
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to KOLs
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">KOL Profile</h1>
              <p className="text-muted-foreground">
                Comprehensive KOL management and performance analytics
              </p>
            </div>
          </div>
        </div>

        {/* Header with Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-800">
                    ${(kol.target || 0) * 50}
                  </p>
                  <p className="text-sm text-green-600">Est. Earnings</p>
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
                    {kol.seed || 0}
                  </p>
                  <p className="text-sm text-primary/70">Direct Mints</p>
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
                    {Math.floor((kol.seed || 0) / 10)}
                  </p>
                  <p className="text-sm text-primary/70">Team Size</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-6 w-6 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold text-primary">
                    Active
                  </p>
                  <p className="text-sm text-primary/70">Status</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Performance</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Team</span>
            </TabsTrigger>
            <TabsTrigger value="compliance" className="flex items-center space-x-2">
              <Shield className="h-4 w-4" />
              <span>Compliance</span>
            </TabsTrigger>
            <TabsTrigger value="social" className="flex items-center space-x-2">
              <Globe className="h-4 w-4" />
              <span>Social</span>
            </TabsTrigger>
            <TabsTrigger value="admin" className="flex items-center space-x-2">
              <Settings className="h-4 w-4" />
              <span>Admin</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="font-medium">{kol.name}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="font-medium">{kol.email || "Not provided"}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground">Wallet Address</p>
                      <div className="flex items-center space-x-2">
                        <code className="text-sm bg-muted px-2 py-1 rounded max-w-[200px] truncate">
                          {kol.walletAddress}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyWalletAddress(kol.walletAddress)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">KOL ID</p>
                      <code className="text-sm bg-muted px-2 py-1 rounded">
                        {kol.kolId}
                      </code>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* NFT Allocations */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">NFT Allocations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {kol.target || 0}
                      </p>
                      <p className="text-sm text-blue-600">Target</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {kol.seed || 0}
                      </p>
                      <p className="text-sm text-green-600">Seed</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <p className="text-2xl font-bold text-purple-600">
                        {kol.tree || 0}
                      </p>
                      <p className="text-sm text-purple-600">Tree</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">
                        {kol.solar || 0}
                      </p>
                      <p className="text-sm text-orange-600">Solar</p>
                    </div>
                  </div>
                  
                  <div className="text-center p-3 bg-gray-50 rounded-lg">
                    <p className="text-2xl font-bold text-gray-600">
                      {kol.compute || 0}
                    </p>
                    <p className="text-sm text-gray-600">Compute</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Referral Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Referral Information</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Referral Link</p>
                    <div className="flex items-center space-x-2">
                      <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate">
                        {(() => {
                          const digits = kol.kolId.match(/\d{6}/)?.[0] || ""
                          const localizedMintPath = createLocalizedHref(`/mint/${digits}`, locale)
                          return `${window.location.origin}${localizedMintPath}`
                        })()}
                      </code>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyReferralLink(kol.kolId)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" asChild>
                      <a 
                        href={createLocalizedHref(`/mint/${kol.kolId.match(/\d{6}/)?.[0] || ""}`, locale)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3 mr-2" />
                        Open Mint Page
                      </a>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="performance" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Performance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                  <CardDescription>Current period highlights</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-blue-50 rounded-lg">
                      <p className="text-xl font-bold text-blue-600">
                        {kol.seed || 0}
                      </p>
                      <p className="text-sm text-blue-600">Direct Mints</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <p className="text-xl font-bold text-green-600">
                        {((kol.seed || 0) / Math.max(kol.target || 1, 1) * 100).toFixed(1)}%
                      </p>
                      <p className="text-sm text-green-600">Target Progress</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">Total Allocations</span>
                      <span className="font-medium">
                        {(kol.seed || 0) + (kol.tree || 0) + (kol.solar || 0) + (kol.compute || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">Conversion Rate</span>
                      <span className="font-medium">
                        {((kol.seed || 0) / Math.max(kol.target || 1, 1) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Earnings Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Earnings Breakdown</CardTitle>
                  <CardDescription>Revenue and commission details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">Direct Commission</span>
                      <span className="font-medium">${(kol.seed || 0) * 20}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">Team Commission</span>
                      <span className="font-medium">${Math.floor((kol.seed || 0) / 10) * 50}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-primary/70">Total Earnings</span>
                      <span className="font-bold text-green-600">
                        ${(kol.seed || 0) * 20 + Math.floor((kol.seed || 0) / 10) * 50}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="team" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Team Hierarchy</CardTitle>
                <CardDescription>KOL&apos;s recruitment network</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">L1 Team Members</span>
                      </div>
                      <p className="text-2xl font-bold text-blue-600">
                        {Math.floor((kol.seed || 0) / 10)}
                      </p>
                      <p className="text-sm text-muted-foreground">Direct recruits</p>
                    </div>
                    
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <Users className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">L2 Team Members</span>
                      </div>
                      <p className="text-2xl font-bold text-purple-600">
                        {Math.floor((kol.seed || 0) / 20)}
                      </p>
                      <p className="text-sm text-muted-foreground">Indirect recruits</p>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-green-600" />
                      <span className="font-medium">Team Performance</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total team mints: {Math.floor((kol.seed || 0) * 1.5)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="compliance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Status</CardTitle>
                <CardDescription>Account standing and compliance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-green-800">Account Status</span>
                  <Badge className="bg-green-500 text-white">Active</Badge>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-primary/70">Posts Submitted</span>
                    <span className="font-medium">{Math.floor((kol.seed || 0) / 5)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-primary/70">Posts Approved</span>
                    <span className="font-medium text-green-600">{Math.floor((kol.seed || 0) / 6)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-primary/70">Compliance Score</span>
                    <span className="font-medium text-green-600">95%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-primary/70">Strikes</span>
                    <span className="font-medium">0/3</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="social" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Social Media Presence</CardTitle>
                <CardDescription>KOL&apos;s social media accounts and metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Twitter className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">Twitter</span>
                    </div>
                    <p className="text-sm text-muted-foreground">@kol_{kol.name.toLowerCase().replace(/\s+/g, '_')}</p>
                    <p className="text-sm text-muted-foreground">Followers: {Math.floor((kol.seed || 0) * 100)}</p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center space-x-2 mb-2">
                      <Youtube className="h-4 w-4 text-red-500" />
                      <span className="font-medium">YouTube</span>
                    </div>
                    <p className="text-sm text-muted-foreground">KOL {kol.name}</p>
                    <p className="text-sm text-muted-foreground">Subscribers: {Math.floor((kol.seed || 0) * 50)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="admin" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Admin Actions</CardTitle>
                <CardDescription>Administrative controls and overrides</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tier</label>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800">
                        Ambassador
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Status</label>
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-green-500 text-white">
                        Active
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Commission Override (%)</label>
                  <div className="flex items-center space-x-2">
                    <input 
                      type="number" 
                      placeholder="0" 
                      className="w-32 px-3 py-2 border rounded-md"
                    />
                    <Button size="sm">
                      <Save className="h-3 w-3 mr-1" />
                      Save
                    </Button>
                  </div>
                </div>
                
                <div className="flex space-x-2 pt-4">
                  <Button variant="outline" size="sm">
                    <Settings className="h-3 w-3 mr-1" />
                    Advanced Settings
                  </Button>
                  <Button variant="destructive" size="sm">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Suspend KOL
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
