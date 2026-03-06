"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search, 
  Eye,
  User,
  Mail,
  MapPin,
  MessageSquare,
  Wallet
} from "lucide-react";

interface WhitelistApplication {
  id: string;
  name: string;
  email: string;
  telegramUsername: string;
  country: string;
  walletAddress: string;
  isKOL: boolean;
  status: 'pending' | 'approved' | 'declined';
  submittedAt: Date;
  hearAbout?: string[];
  interests?: string[];
  yourInterest?: string;
  plannedInvestment?: string;
  reviewedAt?: Date;
  reviewedBy?: string;
}

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  claims: {
    role: string | null;
    roles: string[];
    admin: boolean;
  };
};

export default function WhitelistApplicationsPage() {
  const [applications, setApplications] = useState<WhitelistApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedApplication, setSelectedApplication] = useState<WhitelistApplication | null>(null);
  const [isProcessing, setIsProcessing] = useState<{id: string, action: string} | null>(null);
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
    isSuperAdmin: false,
    claims: { role: null, roles: [], admin: false }
  });

  useEffect(() => {
    const checkAuth = async () => {
      if (!auth.currentUser) {
        setWho({ authed: false, email: null, isAdmin: false, isSuperAdmin: false, claims: { role: null, roles: [], admin: false } });
        setLoading(false);
        return;
      }
      
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        const res = await fetch("/api/admin/whoami", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        
        if (res.ok) {
          const data = await res.json();
          setWho({
            authed: data.authed,
            email: data.email,
            isAdmin: data.isAdmin,
            isSuperAdmin: data.isSuperAdmin,
            claims: data.claims
          });
          
          if (data.isAdmin) {
            await fetchApplications();
          } else {
            setLoading(false);
          }
        } else {
          setWho({ authed: false, email: null, isAdmin: false, isSuperAdmin: false, claims: { role: null, roles: [], admin: false } });
          setLoading(false);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        setWho({ authed: false, email: null, isAdmin: false, isSuperAdmin: false, claims: { role: null, roles: [], admin: false } });
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const fetchApplications = async () => {
    try {
      const response = await fetch('/api/admin/whitelist-applications');
      if (!response.ok) {
        throw new Error('Failed to fetch applications');
      }
      
      const data = await response.json();
      const applicationsData = data.applications.map((app: WhitelistApplication) => ({
        ...app,
        submittedAt: new Date(app.submittedAt),
        reviewedAt: app.reviewedAt ? new Date(app.reviewedAt) : undefined
      }));
      
      setApplications(applicationsData);
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast.error("Failed to fetch applications");
    } finally {
      setLoading(false);
    }
  };

  const handleApplicationAction = async (applicationId: string, action: 'approve' | 'decline') => {
    setIsProcessing({id: applicationId, action});
    try {
      const response = await fetch(`/api/admin/whitelist-applications/${applicationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          reviewedBy: who.email
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to process application');
      }
      
      toast.success(`Application ${action === 'approve' ? 'approved' : 'declined'} successfully`);
      await fetchApplications();
    } catch (error) {
      console.error(`Error ${action}ing application:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to ${action} application`);
    } finally {
      setIsProcessing(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'declined':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Declined</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  const filteredApplications = applications.filter(app =>
    app.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    app.walletAddress.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <LoadingSpinner size="lg" text="Loading applications..." />
        </div>
      </DashboardLayout>
    );
  }

  if (!who.authed || !who.isAdmin) {
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
            <h2 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h2>
            <p className="text-muted-foreground">
              You don&apos;t have permission to access this page.
            </p>
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
        {/* Search and Stats */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 max-w-md">
            <Label htmlFor="search">Search Applications</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="search"
                placeholder="Search by name, email, or wallet..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex gap-4">
            <Card className="p-4">
              <div className="text-2xl font-bold text-blue-600">
                {applications.filter(app => app.status === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-green-600">
                {applications.filter(app => app.status === 'approved').length}
              </div>
              <div className="text-sm text-gray-600">Approved</div>
            </Card>
            <Card className="p-4">
              <div className="text-2xl font-bold text-red-600">
                {applications.filter(app => app.status === 'declined').length}
              </div>
              <div className="text-sm text-gray-600">Declined</div>
            </Card>
          </div>
        </div>

        {/* Applications Table */}
        <Card>
          <CardHeader>
            <CardTitle>Whitelist Applications ({filteredApplications.length})</CardTitle>
            <CardDescription>
              Review and manage whitelist applications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Wallet</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredApplications.map((application) => (
                  <TableRow key={application.id}>
                    <TableCell className="font-medium">{application.name}</TableCell>
                    <TableCell>{application.email}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {application.walletAddress.slice(0, 6)}...{application.walletAddress.slice(-4)}
                    </TableCell>
                    <TableCell>{getStatusBadge(application.status)}</TableCell>
                    <TableCell>
                      {application.isKOL ? (
                        <Badge className="bg-purple-100 text-purple-800">KOL</Badge>
                      ) : (
                        <Badge variant="outline">Regular</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {application.submittedAt.toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedApplication(application)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Application Details</DialogTitle>
                              <DialogDescription>
                                Review application details and take action
                              </DialogDescription>
                            </DialogHeader>
                            
                            {selectedApplication && (
                              <div className="space-y-6">
                                {/* Basic Info */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <User className="h-4 w-4 text-gray-500" />
                                      <span className="font-medium">Name:</span>
                                      <span>{selectedApplication.name}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Mail className="h-4 w-4 text-gray-500" />
                                      <span className="font-medium">Email:</span>
                                      <span className="truncate">{selectedApplication.email}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <MessageSquare className="h-4 w-4 text-gray-500" />
                                      <span className="font-medium">Telegram:</span>
                                      <span>{selectedApplication.telegramUsername}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <MapPin className="h-4 w-4 text-gray-500" />
                                      <span className="font-medium">Country:</span>
                                      <span>{selectedApplication.country}</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Wallet className="h-4 w-4 text-gray-500" />
                                      <span className="font-medium">Wallet:</span>
                                      <span className="font-mono text-sm">{selectedApplication.walletAddress}</span>
                                    </div>
                                  </div>
                                  
                                  <div className="space-y-2">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium">Status:</span>
                                      {getStatusBadge(selectedApplication.status)}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium">Type:</span>
                                      {selectedApplication.isKOL ? (
                                        <Badge className="bg-purple-100 text-purple-800">KOL</Badge>
                                      ) : (
                                        <Badge variant="outline">Regular</Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <span className="font-medium">Submitted:</span>
                                      <span>{selectedApplication.submittedAt.toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Additional Info for Regular Users */}
                                {!selectedApplication.isKOL && (
                                  <div className="space-y-4">
                                    <div>
                                      <h4 className="font-medium mb-2">How they heard about AGV:</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {selectedApplication.hearAbout?.map((item, index) => (
                                          <Badge key={index} variant="outline">{item}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    <div>
                                      <h4 className="font-medium mb-2">Interests:</h4>
                                      <div className="flex flex-wrap gap-2">
                                        {selectedApplication.interests?.map((item, index) => (
                                          <Badge key={index} variant="outline">{item}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      <div>
                                        <h4 className="font-medium mb-2">Interest Type:</h4>
                                        <Badge variant="outline">
                                          {selectedApplication.yourInterest === 'airdrop' ? 'Airdrop only' :
                                           selectedApplication.yourInterest === 'presale' ? 'Pre-sale only' :
                                           selectedApplication.yourInterest === 'both' ? 'Both' : 'N/A'}
                                        </Badge>
                                      </div>
                                      <div>
                                        <h4 className="font-medium mb-2">Planned Investment:</h4>
                                        <Badge variant="outline">
                                          {selectedApplication.plannedInvestment === '100-500' ? '$100 – $500' :
                                           selectedApplication.plannedInvestment === '500-1000' ? '$500 – $1,000' :
                                           selectedApplication.plannedInvestment === '1000-5000' ? '$1,000 – $5,000' :
                                           selectedApplication.plannedInvestment === '5000+' ? '$5,000+' : 'N/A'}
                                        </Badge>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Action Buttons */}
                                {selectedApplication.status === 'pending' && (
                                  <div className="flex gap-4 pt-4 border-t">
                                    <Button
                                      onClick={() => handleApplicationAction(selectedApplication.id, 'approve')}
                                      disabled={isProcessing?.id === selectedApplication.id}
                                      className="bg-green-600 hover:bg-green-700"
                                    >
                                      {isProcessing?.id === selectedApplication.id && isProcessing?.action === 'approve' ? (
                                        <LoadingSpinner size="sm" />
                                      ) : (
                                        <>
                                          <CheckCircle className="h-4 w-4 mr-2" />
                                          Approve
                                        </>
                                      )}
                                    </Button>
                                    <Button
                                      onClick={() => handleApplicationAction(selectedApplication.id, 'decline')}
                                      disabled={isProcessing?.id === selectedApplication.id}
                                      variant="destructive"
                                    >
                                      {isProcessing?.id === selectedApplication.id && isProcessing?.action === 'decline' ? (
                                        <LoadingSpinner size="sm" />
                                      ) : (
                                        <>
                                          <XCircle className="h-4 w-4 mr-2" />
                                          Decline
                                        </>
                                      )}
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        
                        {application.status === 'pending' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleApplicationAction(application.id, 'approve')}
                              disabled={isProcessing?.id === application.id}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              {isProcessing?.id === application.id && isProcessing?.action === 'approve' ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleApplicationAction(application.id, 'decline')}
                              disabled={isProcessing?.id === application.id}
                            >
                              {isProcessing?.id === application.id && isProcessing?.action === 'decline' ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                <XCircle className="h-4 w-4" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            
            {filteredApplications.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No applications found</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
