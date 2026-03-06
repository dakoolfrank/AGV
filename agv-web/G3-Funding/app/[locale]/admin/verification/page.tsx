'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { 
  getAllContributorApplications, 
  updateContributorApplication 
} from '@/lib/firebase-service';
import { ContributorApplication } from '@/lib/types';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/admin/ErrorBoundary';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminAuthWrapper } from '@/components/admin/AdminAuthWrapper';
import { formatDate, formatDateTime, getTierColor } from '@/lib/admin-utils';
import { Search, CheckCircle, XCircle, ExternalLink, Globe, Users, Eye } from 'lucide-react';

function VerificationContent() {
  const [applications, setApplications] = useState<ContributorApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<ContributorApplication | null>(null);
  const [verificationFilter, setVerificationFilter] = useState<string>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    try {
      setIsLoading(true);
      const data = await getAllContributorApplications();
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
      toast.error('Failed to load applications');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerificationUpdate = async (appId: string, channelIndex: number, newStatus: 'verified' | 'failed') => {
    try {
      const app = applications.find(a => a.id === appId);
      if (!app) return;

      const updatedChannels = [...app.channels];
      updatedChannels[channelIndex] = {
        ...updatedChannels[channelIndex],
        verificationStatus: newStatus,
        verifiedAt: new Date(),
        verificationMethod: 'manual'
      };

      await updateContributorApplication(appId, { 
        channels: updatedChannels,
        reviewerNotes: verificationNotes,
        lastReviewedBy: 'Admin',
        lastReviewedAt: new Date()
      });
      
      setApplications(prev => prev.map(app => 
        app.id === appId ? { ...app, channels: updatedChannels } : app
      ));
      
      toast.success('Channel verification updated successfully');
      setVerificationNotes('');
    } catch (error) {
      console.error('Error updating verification:', error);
      toast.error('Failed to update channel verification');
    }
  };

  const getVerificationStatus = (app: ContributorApplication) => {
    const channels = app.channels || [];
    if (channels.length === 0) return 'no_channels';
    
    const pending = channels.filter(c => c.verificationStatus === 'pending').length;
    const verified = channels.filter(c => c.verificationStatus === 'verified').length;
    const failed = channels.filter(c => c.verificationStatus === 'failed').length;
    
    if (pending > 0) return 'pending';
    if (failed > 0) return 'partial';
    if (verified === channels.length) return 'verified';
    return 'pending';
  };

  const filteredApps = applications.filter(app => {
    const matchesVerification = verificationFilter === 'all' || getVerificationStatus(app) === verificationFilter;
    const matchesSearch = searchTerm === '' || 
      app.identity.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.identity.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesVerification && matchesSearch;
  });

  const getVerificationColor = (status: string) => {
    switch (status) {
      case 'verified': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'partial': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Channel Verification" description="Verify social media channels for contributors">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading applications...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <ErrorBoundary>
      <AdminLayout title="Channel Verification" description="Verify social media channels for contributors">
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Applications</p>
                    <p className="text-2xl font-bold">{applications.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-yellow-100 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Pending Verification</p>
                    <p className="text-2xl font-bold">{applications.filter(app => getVerificationStatus(app) === 'pending').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-green-100 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Verified</p>
                    <p className="text-2xl font-bold">{applications.filter(app => getVerificationStatus(app) === 'verified').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-orange-100 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Partial</p>
                    <p className="text-2xl font-bold">{applications.filter(app => getVerificationStatus(app) === 'partial').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters and Search */}
          <Card>
            <CardHeader>
              <CardTitle>Filters & Search</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      placeholder="Search by name or email..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={verificationFilter}
                    onChange={(e) => setVerificationFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="pending">Pending Verification</option>
                    <option value="verified">Verified</option>
                    <option value="partial">Partially Verified</option>
                    <option value="failed">Failed</option>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Applications List */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>
                    Applications ({filteredApps.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredApps.map((app) => {
                      const verificationStatus = getVerificationStatus(app);
                      return (
                        <div
                          key={app.id}
                          className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                            selectedApp?.id === app.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                          }`}
                          onClick={() => setSelectedApp(app)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h3 className="font-medium text-lg">
                                {app.identity.displayName}
                              </h3>
                              <p className="text-sm text-muted-foreground">
                                {app.identity.email}
                              </p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className={getTierColor(app.tier)}>
                                  {app.tier.replace('_', ' ').toUpperCase()}
                                </Badge>
                                <Badge variant="outline">
                                  <Globe className="h-3 w-3 mr-1" />
                                  {app.channels.length} channels
                                </Badge>
                                <Badge className={getVerificationColor(verificationStatus)}>
                                  {verificationStatus.toUpperCase()}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">
                                {formatDate(app.createdAt)}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    
                    {filteredApps.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No applications found for the selected filters.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Channel Verification Details */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>Channel Verification</CardTitle>
                </CardHeader>
                <CardContent>
                  {selectedApp ? (
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-medium mb-2">Contributor Details</h3>
                        <div className="text-sm space-y-1">
                          <p><strong>Name:</strong> {selectedApp.identity.displayName}</p>
                          <p><strong>Email:</strong> {selectedApp.identity.email}</p>
                          <p><strong>Tier:</strong> {selectedApp.tier}</p>
                          <p><strong>Country:</strong> {selectedApp.identity.countryRegion}</p>
                        </div>
                      </div>

                      <div>
                        <h3 className="font-medium mb-2">Social Media Channels</h3>
                        <div className="space-y-3">
                          {selectedApp.channels.map((channel, index) => (
                            <div key={index} className="p-3 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center space-x-2">
                                  <span className="font-medium">{channel.platform}</span>
                                  <Badge className={getVerificationColor(channel.verificationStatus || 'pending')}>
                                    {channel.verificationStatus || 'pending'}
                                  </Badge>
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => window.open(channel.url, '_blank')}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </Button>
                              </div>
                              
                              <div className="text-sm space-y-1 mb-3">
                                <p><strong>URL:</strong> {channel.url}</p>
                                <p><strong>Followers:</strong> {channel.followers.toLocaleString()}</p>
                                <p><strong>Content Focus:</strong> {channel.contentFocus}</p>
                                <p><strong>Audience:</strong> {channel.audienceTop3Geos.join(', ')}</p>
                              </div>

                              {channel.verificationStatus === 'pending' && (
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleVerificationUpdate(selectedApp.id!, index, 'verified')}
                                    className="flex-1"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Verify
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleVerificationUpdate(selectedApp.id!, index, 'failed')}
                                    className="flex-1"
                                  >
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Reject
                                  </Button>
                                </div>
                              )}

                              {channel.verifiedAt && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Verified: {formatDateTime(channel.verifiedAt)}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="font-medium mb-2">Verification Notes</h3>
                        <Textarea
                          placeholder="Add verification notes..."
                          value={verificationNotes}
                          onChange={(e) => setVerificationNotes(e.target.value)}
                          className="min-h-[80px]"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Select an application to verify channels</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  );
}

export default function VerificationPage() {
  return (
    <AdminAuthWrapper>
      <VerificationContent />
    </AdminAuthWrapper>
  );
}
