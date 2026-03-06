'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Users, 
  ChevronDown, 
  ChevronRight, 
  TrendingUp, 
  Calendar,
  DollarSign,
  Activity,
  Filter,
  Search
} from 'lucide-react';
import { KOLTier, KOLStatus } from '@/lib/types';

interface TeamMember {
  id: string;
  displayName: string;
  tier: KOLTier;
  status: KOLStatus;
  mints: number;
  commissionGenerated: number;
  lastActive: Date;
  parentId?: string;
}

interface TeamTableProps {
  l1KOLs: TeamMember[];
  l2KOLs: TeamMember[];
}

export function TeamTable({ l1KOLs, l2KOLs }: TeamTableProps) {
  const [expandedL1, setExpandedL1] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  const toggleL1Expansion = (kolId: string) => {
    const newExpanded = new Set(expandedL1);
    if (newExpanded.has(kolId)) {
      newExpanded.delete(kolId);
    } else {
      newExpanded.add(kolId);
    }
    setExpandedL1(newExpanded);
  };
  
  const getTierColor = (tier: KOLTier) => {
    switch (tier) {
      case 'pioneer': return 'bg-green-500';
      case 'ambassador': return 'bg-blue-500';
      case 'partner': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };
  
  const getStatusColor = (status: KOLStatus) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'suspended': return 'bg-red-100 text-red-800';
      case 'inactive': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };
  
  const formatDate = (date: Date) => {
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(
      Math.floor((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      'day'
    );
  };
  
  const filteredL1KOLs = l1KOLs.filter(kol => {
    const matchesSearch = kol.displayName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && kol.status === 'active') ||
      (filterStatus === 'inactive' && kol.status !== 'active');
    return matchesSearch && matchesStatus;
  });
  
  const getL2KOLsForParent = (parentId: string) => {
    return l2KOLs.filter(kol => kol.parentId === parentId);
  };
  
  const totalL1Commission = l1KOLs.reduce((sum, kol) => sum + kol.commissionGenerated, 0);
  const totalL2Commission = l2KOLs.reduce((sum, kol) => sum + kol.commissionGenerated, 0);
  const totalMints = l1KOLs.reduce((sum, kol) => sum + kol.mints, 0) + 
                    l2KOLs.reduce((sum, kol) => sum + kol.mints, 0);
  
  return (
    <div className="space-y-6">
      {/* Header & Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h2 className="text-2xl font-bold text-primary">My Team</h2>
          <p className="text-primary/70">Manage your downline and track their performance</p>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">{l1KOLs.length + l2KOLs.length}</p>
                <p className="text-xs text-primary/70">Total Team</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">{totalMints}</p>
                <p className="text-xs text-primary/70">Team Mints</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">{formatCurrency(totalL1Commission + totalL2Commission)}</p>
                <p className="text-xs text-primary/70">Override Earned</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search team members..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                All
              </Button>
              <Button
                variant={filterStatus === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('active')}
              >
                Active
              </Button>
              <Button
                variant={filterStatus === 'inactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('inactive')}
              >
                Inactive
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Team Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Team Members</span>
          </CardTitle>
          <CardDescription>
            L1 members earn you override commissions, L2 members provide additional overrides
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredL1KOLs.length === 0 ? (
              <div className="text-center py-8 text-primary/70">
                <Users className="h-12 w-12 mx-auto mb-4 text-primary/30" />
                <p className="text-lg font-medium">No team members yet</p>
                <p className="text-sm">Share your recruitment link to start building your team</p>
              </div>
            ) : (
              filteredL1KOLs.map((l1Kol) => {
                const l2Children = getL2KOLsForParent(l1Kol.id);
                const isExpanded = expandedL1.has(l1Kol.id);
                
                return (
                  <div key={l1Kol.id} className="border rounded-lg">
                    {/* L1 KOL Row */}
                    <div className="p-4 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          {l2Children.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleL1Expansion(l1Kol.id)}
                              className="p-1"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                              <span className="text-sm font-medium text-primary">
                                {l1Kol.displayName.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            
                            <div>
                              <p className="font-medium text-primary">{l1Kol.displayName}</p>
                              <div className="flex items-center space-x-2">
                                <Badge className={`${getTierColor(l1Kol.tier)} text-white text-xs`}>
                                  {l1Kol.tier}
                                </Badge>
                                <Badge variant="outline" className={getStatusColor(l1Kol.status)}>
                                  {l1Kol.status}
                                </Badge>
                                <span className="text-xs text-primary/70">L1</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6 text-sm">
                          <div className="text-center">
                            <p className="font-medium text-primary">{l1Kol.mints}</p>
                            <p className="text-xs text-primary/70">Mints</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="font-medium text-green-600">{formatCurrency(l1Kol.commissionGenerated)}</p>
                            <p className="text-xs text-primary/70">Override</p>
                          </div>
                          
                          <div className="text-center">
                            <p className="font-medium text-primary">{formatDate(l1Kol.lastActive)}</p>
                            <p className="text-xs text-primary/70">Last Active</p>
                          </div>
                          
                          {l2Children.length > 0 && (
                            <div className="text-center">
                              <p className="font-medium text-blue-600">{l2Children.length}</p>
                              <p className="text-xs text-primary/70">L2 Team</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* L2 KOLs (Expanded) */}
                    {isExpanded && l2Children.length > 0 && (
                      <div className="border-t bg-gray-50">
                        {l2Children.map((l2Kol) => (
                          <div key={l2Kol.id} className="p-4 pl-16 border-b last:border-b-0">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="w-6 h-6 bg-primary/10 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-medium text-primary">
                                    {l2Kol.displayName.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                
                                <div>
                                  <p className="font-medium text-primary text-sm">{l2Kol.displayName}</p>
                                  <div className="flex items-center space-x-2">
                                    <Badge className={`${getTierColor(l2Kol.tier)} text-white text-xs`}>
                                      {l2Kol.tier}
                                    </Badge>
                                    <Badge variant="outline" className={getStatusColor(l2Kol.status)}>
                                      {l2Kol.status}
                                    </Badge>
                                    <span className="text-xs text-primary/70">L2</span>
                                  </div>
                                </div>
                              </div>
                              
                              <div className="flex items-center space-x-6 text-sm">
                                <div className="text-center">
                                  <p className="font-medium text-primary">{l2Kol.mints}</p>
                                  <p className="text-xs text-primary/70">Mints</p>
                                </div>
                                
                                <div className="text-center">
                                  <p className="font-medium text-green-600">{formatCurrency(l2Kol.commissionGenerated)}</p>
                                  <p className="text-xs text-primary/70">Override</p>
                                </div>
                                
                                <div className="text-center">
                                  <p className="font-medium text-primary">{formatDate(l2Kol.lastActive)}</p>
                                  <p className="text-xs text-primary/70">Last Active</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
