'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { 
  getAllInstitutionalApplications, 
  getAllContributorApplications,
  getAdminStats 
} from '@/lib/firebase-service';
import { InstitutionalApplication, ContributorApplication, AdminStats } from '@/lib/types';
import { ErrorBoundary } from '@/components/admin/ErrorBoundary';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { AdminAuthWrapper } from '@/components/admin/AdminAuthWrapper';
import { StatusSyncButton } from '@/components/admin/StatusSyncButton';
import { formatDate, getStatusColor, getTierColor } from '@/lib/admin-utils';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Building2, 
  Calendar,
  Filter
} from 'lucide-react';

function DashboardContent() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [institutionalApps, setInstitutionalApps] = useState<InstitutionalApplication[]>([]);
  const [contributorApps, setContributorApps] = useState<ContributorApplication[]>([]);
  const [timeRange, setTimeRange] = useState<string>('30');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [timeRange]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [statsData, institutionalData, contributorData] = await Promise.all([
        getAdminStats(),
        getAllInstitutionalApplications(),
        getAllContributorApplications()
      ]);
      
      setStats(statsData);
      setInstitutionalApps(institutionalData);
      setContributorApps(contributorData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getApplicationsByTimeRange = (apps: any[], days: number) => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return apps.filter(app => {
      const appDate = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
      return appDate >= cutoffDate;
    });
  };

  const getApplicationsByMonth = (apps: any[]) => {
    const monthlyData: { [key: string]: number } = {};
    
    apps.forEach(app => {
      const date = app.createdAt?.toDate ? app.createdAt.toDate() : new Date(app.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + 1;
    });
    
    return monthlyData;
  };

  const getTopCountries = (apps: any[]) => {
    const countryCount: { [key: string]: number } = {};
    
    apps.forEach(app => {
      const country = app.identity?.countryRegion || app.organizationProfile?.jurisdiction || 'Unknown';
      countryCount[country] = (countryCount[country] || 0) + 1;
    });
    
    return Object.entries(countryCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
  };

  const getTierDistribution = (apps: ContributorApplication[]) => {
    const tierCount: { [key: string]: number } = {};
    
    apps.forEach(app => {
      tierCount[app.tier] = (tierCount[app.tier] || 0) + 1;
    });
    
    return Object.entries(tierCount);
  };

  const getOrganizationTypeDistribution = (apps: InstitutionalApplication[]) => {
    const typeCount: { [key: string]: number } = {};
    
    apps.forEach(app => {
      const type = app.organizationProfile.organizationType;
      typeCount[type] = (typeCount[type] || 0) + 1;
    });
    
    return Object.entries(typeCount);
  };

  if (isLoading) {
    return (
      <AdminLayout title="Dashboard" description="Application analytics and insights">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const filteredInstitutionalApps = getApplicationsByTimeRange(institutionalApps, parseInt(timeRange));
  const filteredContributorApps = getApplicationsByTimeRange(contributorApps, parseInt(timeRange));
  const monthlyInstitutional = getApplicationsByMonth(filteredInstitutionalApps);
  const monthlyContributor = getApplicationsByMonth(filteredContributorApps);
  const topCountries = getTopCountries([...filteredInstitutionalApps, ...filteredContributorApps]);
  const tierDistribution = getTierDistribution(filteredContributorApps);
  const orgTypeDistribution = getOrganizationTypeDistribution(filteredInstitutionalApps);

  return (
    <ErrorBoundary>
      <AdminLayout title="Dashboard" description="Application analytics and insights">
        <div className="space-y-6">
          {/* Time Range Filter */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Dashboard Overview</CardTitle>
                <div className="flex items-center space-x-4">
                  <Select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                  >
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                    <option value="365">Last year</option>
                  </Select>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Key Metrics - Original Dashboard Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Institutional Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.institutionalApplications.total || 0}</div>
                <div className="text-xs text-muted-foreground">
                  {Object.entries(stats?.institutionalApplications.byStatus || {}).map(([status, count]) => (
                    <span key={status} className="mr-2">
                      {status}: {count}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Contributor Applications
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.contributorApplications.total || 0}</div>
                <div className="text-xs text-muted-foreground">
                  {Object.entries(stats?.contributorApplications.byTier || {}).map(([tier, count]) => (
                    <span key={tier} className="mr-2">
                      {tier}: {count}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(stats?.institutionalApplications.byStatus.new || 0) + 
                   (stats?.contributorApplications.byStatus.new || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Applications awaiting review</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Approved
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(stats?.institutionalApplications.byStatus.approved || 0) + 
                   (stats?.contributorApplications.byStatus.approved || 0)}
                </div>
                <p className="text-xs text-muted-foreground">Total approved applications</p>
              </CardContent>
            </Card>
          </div>

          {/* Additional Analytics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Building2 className="h-8 w-8 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Institutional (Last {timeRange}d)</p>
                    <p className="text-2xl font-bold">{filteredInstitutionalApps.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {institutionalApps.length - filteredInstitutionalApps.length} outside range
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Users className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Contributor (Last {timeRange}d)</p>
                    <p className="text-2xl font-bold">{filteredContributorApps.length}</p>
                    <p className="text-xs text-muted-foreground">
                      {contributorApps.length - filteredContributorApps.length} outside range
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total (Last {timeRange}d)</p>
                    <p className="text-2xl font-bold">{filteredInstitutionalApps.length + filteredContributorApps.length}</p>
                    <p className="text-xs text-muted-foreground">
                      Applications in range
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-8 w-8 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg. per Day</p>
                    <p className="text-2xl font-bold">
                      {Math.round((filteredInstitutionalApps.length + filteredContributorApps.length) / parseInt(timeRange))}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Applications per day
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Status Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Application Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Institutional Applications</h4>
                    <div className="space-y-2">
                      {Object.entries(stats?.institutionalApplications.byStatus || {}).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(status).split(' ')[0]}`} />
                            <span className="text-sm capitalize">{status}</span>
                          </div>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium mb-2">Contributor Applications</h4>
                    <div className="space-y-2">
                      {Object.entries(stats?.contributorApplications.byStatus || {}).map(([status, count]) => (
                        <div key={status} className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className={`w-3 h-3 rounded-full ${getStatusColor(status).split(' ')[0]}`} />
                            <span className="text-sm capitalize">{status}</span>
                          </div>
                          <span className="font-medium">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tier Distribution */}
            <Card>
              <CardHeader>
                <CardTitle>Contributor Tier Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tierDistribution.map(([tier, count]) => (
                    <div key={tier} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Badge className={getTierColor(tier)}>
                          {tier.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </div>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Top Countries */}
            <Card>
              <CardHeader>
                <CardTitle>Top Countries</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topCountries.map(([country, count]) => (
                    <div key={country} className="flex items-center justify-between">
                      <span className="text-sm">{country}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Organization Types */}
            <Card>
              <CardHeader>
                <CardTitle>Organization Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {orgTypeDistribution.map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                      <span className="font-medium">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Status Synchronization Tool */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StatusSyncButton />
          </div>

        </div>
      </AdminLayout>
    </ErrorBoundary>
  );
}

export default function DashboardPage() {
  return (
    <AdminAuthWrapper>
      <DashboardContent />
    </AdminAuthWrapper>
  );
}