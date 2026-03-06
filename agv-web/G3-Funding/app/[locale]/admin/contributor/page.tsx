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
import { ApplicationDetailsModal } from '@/components/admin/ApplicationDetailsModal';
import { formatDate, formatDateTime, getStatusColor, getTierColor, statusOptions } from '@/lib/admin-utils';
import { Search, Filter, Eye, CheckCircle, XCircle, Users, Globe } from 'lucide-react';

function ContributorApplicationsContent() {
  const [applications, setApplications] = useState<ContributorApplication[]>([]);
  const [selectedApp, setSelectedApp] = useState<ContributorApplication | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const handleStatusUpdate = async (appId: string, newStatus: string, notes: string) => {
    try {
      await updateContributorApplication(appId, { 
        status: newStatus as any,
        reviewerNotes: notes,
        lastReviewedBy: 'Admin',
        lastReviewedAt: new Date()
      });
      
      setApplications(prev => prev.map(app => 
        app.id === appId ? { ...app, status: newStatus as any, reviewerNotes: notes } : app
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      throw error;
    }
  };

  const handleAppClick = (app: ContributorApplication) => {
    setSelectedApp(app);
    setIsModalOpen(true);
  };

  const filteredApps = applications.filter(app => {
    const matchesStatus = statusFilter === 'all' || app.status === statusFilter;
    const matchesTier = tierFilter === 'all' || app.tier === tierFilter;
    const matchesSearch = searchTerm === '' || 
      app.identity.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.identity.email.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesStatus && matchesTier && matchesSearch;
  });

  const tierOptions = [
    { value: 'all', label: 'All Tiers' },
    { value: 'airdrop_hunter', label: 'Airdrop Hunter' },
    { value: 'contributor', label: 'Contributor' },
    { value: 'micro_kol', label: 'Micro KOL' },
    { value: 'fund_partner', label: 'Fund Partner' },
  ];

  if (isLoading) {
    return (
      <AdminLayout title="Contributor Applications" description="Manage contributor applications">
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
      <AdminLayout title="Contributor Applications" description="Manage contributor applications">
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
                  <div className="h-4 w-4 bg-blue-100 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">New</p>
                    <p className="text-2xl font-bold">{applications.filter(app => app.status === 'new').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-green-100 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Approved</p>
                    <p className="text-2xl font-bold">{applications.filter(app => app.status === 'approved').length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <div className="h-4 w-4 bg-red-100 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Declined</p>
                    <p className="text-2xl font-bold">{applications.filter(app => app.status === 'declined').length}</p>
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
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      {statusOptions.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={tierFilter}
                      onChange={(e) => setTierFilter(e.target.value)}
                    >
                    {tierOptions.map((tier) => (
                      <option key={tier.value} value={tier.value}>
                        {tier.label}
                      </option>
                    ))}
                    </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6">
            {/* Applications List */}
            <div>
              <Card>
                <CardHeader>
                  <CardTitle>
                    Applications ({filteredApps.length})
                  </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredApps.map((app) => (
                    <div
                      key={app.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedApp?.id === app.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                      }`}
                        onClick={() => handleAppClick(app)}
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
                                {app.identity.countryRegion}
                              </Badge>
                              <Badge variant="outline">
                                {app.channels.length} channels
                              </Badge>
                            </div>
                        </div>
                        <div className="text-right">
                          <Badge className={getStatusColor(app.status)}>
                            {app.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(app.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {filteredApps.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No applications found for the selected filters.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          </div>

          {/* Application Details Modal */}
          <ApplicationDetailsModal
            application={selectedApp}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setSelectedApp(null);
            }}
            onStatusUpdate={handleStatusUpdate}
            type="contributor"
          />
        </div>
      </AdminLayout>
    </ErrorBoundary>
  );
}

export default function ContributorApplicationsPage() {
  return (
    <AdminAuthWrapper>
      <ContributorApplicationsContent />
    </AdminAuthWrapper>
  );
}