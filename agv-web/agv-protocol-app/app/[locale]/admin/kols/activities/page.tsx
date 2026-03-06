'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Users, 
  DollarSign, 
  TrendingUp,
  Calendar,
  Filter,
  Search,
  RefreshCw
} from 'lucide-react';
import { DashboardLayout } from '@/components/dashboard/dashboard-layout';

interface KOLActivity {
  id: string;
  kolId: string;
  kolName: string;
  activityType: 'mint' | 'referral' | 'post' | 'reward';
  description: string;
  amount?: number;
  timestamp: Date;
  status: 'pending' | 'completed' | 'failed';
}

interface KOLStats {
  totalMints: number;
  totalReferrals: number;
  totalRewards: number;
  activeDays: number;
  lastActivity: Date;
}

export default function KOLActivitiesPage() {
  const [activities, setActivities] = useState<KOLActivity[]>([]);
  const [stats, setStats] = useState<Record<string, KOLStats>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [selectedKOL, setSelectedKOL] = useState<string>('all');

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      // Fetch activities from API
      const response = await fetch('/api/admin/kol-activities');
      const data = await response.json();
      
      setActivities(data.activities || []);
      setStats(data.stats || {});
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.kolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === 'all' || activity.activityType === filterType;
    const matchesKOL = selectedKOL === 'all' || activity.kolId === selectedKOL;
    
    return matchesSearch && matchesType && matchesKOL;
  });

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'mint': return <DollarSign className="h-4 w-4" />;
      case 'referral': return <Users className="h-4 w-4" />;
      case 'post': return <Activity className="h-4 w-4" />;
      case 'reward': return <TrendingUp className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'mint': return 'bg-blue-100 text-blue-800';
      case 'referral': return 'bg-purple-100 text-purple-800';
      case 'post': return 'bg-green-100 text-green-800';
      case 'reward': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
              <div className="h-24 bg-gray-200 rounded"></div>
            </div>
            <div className="h-96 bg-gray-200 rounded"></div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-primary">KOL Activities</h1>
            <p className="text-primary/70">Monitor and manage KOL activities across the platform</p>
          </div>
          <Button onClick={fetchActivities} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <DollarSign className="h-6 w-6 text-blue-600" />
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {activities.filter(a => a.activityType === 'mint').length}
                  </p>
                  <p className="text-sm text-primary/70">Total Mints</p>
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
                    {activities.filter(a => a.activityType === 'referral').length}
                  </p>
                  <p className="text-sm text-primary/70">Referrals</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="h-6 w-6 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {activities.filter(a => a.activityType === 'post').length}
                  </p>
                  <p className="text-sm text-primary/70">Posts</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <TrendingUp className="h-6 w-6 text-orange-600" />
                <div>
                  <p className="text-2xl font-bold text-primary">
                    {activities.filter(a => a.activityType === 'reward').length}
                  </p>
                  <p className="text-sm text-primary/70">Rewards</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filters</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search activities..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Activity Type</label>
                <Select value={filterType} onValueChange={setFilterType}>
                  <option value="all">All Types</option>
                  <option value="mint">Mints</option>
                  <option value="referral">Referrals</option>
                  <option value="post">Posts</option>
                  <option value="reward">Rewards</option>
                </Select>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">KOL</label>
                <Select value={selectedKOL} onValueChange={setSelectedKOL}>
                  <option value="all">All KOLs</option>
                  {/* Add KOL options here */}
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Activities List */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activities</CardTitle>
            <CardDescription>
              {filteredActivities.length} activities found
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {filteredActivities.map((activity) => (
                <div key={activity.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {getActivityIcon(activity.activityType)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{activity.kolName}</h4>
                        <Badge className={getTypeColor(activity.activityType)}>
                          {activity.activityType}
                        </Badge>
                        <Badge className={getStatusColor(activity.status)}>
                          {activity.status}
                        </Badge>
                      </div>
                      <p className="text-sm text-primary/70">{activity.description}</p>
                      {activity.amount && (
                        <p className="text-sm font-medium text-green-600">
                          ${activity.amount.toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-primary/70">
                      {activity.timestamp.toLocaleDateString()}
                    </p>
                    <p className="text-xs text-primary/50">
                      {activity.timestamp.toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {filteredActivities.length === 0 && (
                <div className="text-center py-8">
                  <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-500">No activities found</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
