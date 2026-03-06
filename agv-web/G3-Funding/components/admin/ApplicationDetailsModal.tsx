'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { 
  X, 
  Download, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Building2, 
  User, 
  Globe, 
  FileText, 
  Mail,
  Phone,
  MapPin,
  ExternalLink,
  Users,
  Shield,
  CreditCard,
  Image as ImageIcon,
  File,
  Video,
  Music,
  Target,
  Handshake,
  Copy,
  Calendar
} from 'lucide-react';
import { InstitutionalApplication, ContributorApplication } from '@/lib/types';
import { formatDate, formatDateTime, getStatusColor, getTierColor } from '@/lib/admin-utils';
import { toast } from 'sonner';

interface ApplicationDetailsModalProps {
  application: InstitutionalApplication | ContributorApplication | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusUpdate: (appId: string, newStatus: string, notes: string) => Promise<void>;
  type: 'institutional' | 'contributor';
}

export function ApplicationDetailsModal({ 
  application, 
  isOpen, 
  onClose, 
  onStatusUpdate, 
  type 
}: ApplicationDetailsModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [reviewerNotes, setReviewerNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  if (!application) return null;

  const handleStatusUpdate = async (newStatus: string) => {
    if (!application.id) return;
    
    try {
      setIsUpdating(true);
      await onStatusUpdate(application.id, newStatus, reviewerNotes);
      setReviewerNotes('');
      toast.success('Application status updated successfully');
    } catch (error) {
      console.error('Error updating application status:', error);
      toast.error('Failed to update application status');
    } finally {
      setIsUpdating(false);
    }
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'pdf':
        return <FileText className="h-4 w-4 text-red-500" />;
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return <ImageIcon className="h-4 w-4 text-blue-500" />;
      case 'mp4':
      case 'avi':
      case 'mov':
        return <Video className="h-4 w-4 text-purple-500" />;
      case 'mp3':
      case 'wav':
        return <Music className="h-4 w-4 text-green-500" />;
      default:
        return <File className="h-4 w-4 text-gray-500" />;
    }
  };

  const renderInstitutionalDetails = () => {
    const app = application as InstitutionalApplication;
    
    return (
      <div className="space-y-4">
        {/* Organization Overview */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-xl">
                <div className="p-2 bg-blue-100 rounded-lg mr-3">
                  <Building2 className="h-6 w-6 text-blue-600" />
                </div>
                Organization Profile
              </CardTitle>
              <Badge className={`${getStatusColor(app.status)} shadow-sm`}>
                {app.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-white/60 rounded-lg border border-white/50">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Legal Entity Name</label>
                <p className="text-lg font-semibold text-gray-900">{app.organizationProfile.legalEntityName}</p>
              </div>
              <div className="p-4 bg-white/60 rounded-lg border border-white/50">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Organization Type</label>
                <p className="text-lg font-semibold text-gray-900">{app.organizationProfile.organizationType.replace('_', ' ')}</p>
              </div>
              <div className="p-4 bg-white/60 rounded-lg border border-white/50">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Jurisdiction</label>
                <p className="text-lg font-semibold text-gray-900">{app.organizationProfile.jurisdiction}</p>
              </div>
              <div className="p-4 bg-white/60 rounded-lg border border-white/50">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Registration Number</label>
                <p className="text-lg font-semibold text-gray-900 font-mono">{app.organizationProfile.registrationNumber}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contact Information */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <div className="p-2 bg-green-100 rounded-lg mr-3">
                <Users className="h-6 w-6 text-green-600" />
              </div>
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-white/60 rounded-lg border border-white/50">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Primary Contact</label>
                <p className="text-lg font-semibold text-gray-900">{app.contacts.primary.name}</p>
                <p className="text-sm text-gray-600 mt-1">{app.contacts.primary.title}</p>
              </div>
              <div className="p-4 bg-white/60 rounded-lg border border-white/50">
                <label className="text-sm font-medium text-gray-600 mb-2 block">Email</label>
                <p className="text-lg font-semibold text-gray-900 flex items-center">
                  <Mail className="h-4 w-4 mr-2 text-green-600" />
                  {app.contacts.primary.email}
                </p>
              </div>
              {app.contacts.primary.phone && (
                <div className="p-4 bg-white/60 rounded-lg border border-white/50">
                  <label className="text-sm font-medium text-gray-600 mb-2 block">Phone</label>
                  <p className="text-lg font-semibold text-gray-900 flex items-center">
                    <Phone className="h-4 w-4 mr-2 text-green-600" />
                    {app.contacts.primary.phone}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Purpose & Fit */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-violet-50">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center text-xl">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <Target className="h-6 w-6 text-purple-600" />
              </div>
              Purpose & Fit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-white/60 rounded-lg border border-white/50">
              <label className="text-sm font-medium text-gray-600 mb-3 block">Primary Intent</label>
              <div className="flex flex-wrap gap-2">
                {app.purposeAndFit.primaryIntent.map((intent, index) => (
                  <Badge key={index} variant="secondary" className="text-sm bg-purple-100 text-purple-800 border-purple-200">
                    {intent.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="p-4 bg-white/60 rounded-lg border border-white/50">
              <label className="text-sm font-medium text-gray-600 mb-3 block">RWA Verticals</label>
              <div className="flex flex-wrap gap-2">
                {app.purposeAndFit.rwaVerticals.map((vertical, index) => (
                  <Badge key={index} variant="secondary" className="text-sm bg-violet-100 text-violet-800 border-violet-200">
                    {vertical.replace('_', ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Partnership Mode */}
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <Handshake className="h-5 w-5 mr-2 text-orange-600" />
              Partnership Mode
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Primary Intent</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {app.purposeAndFit.primaryIntent.map((intent, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      {intent.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">RWA Verticals</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {app.purposeAndFit.rwaVerticals.map((vertical, index) => (
                    <Badge key={index} variant="outline" className="text-sm">
                      {vertical.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderContributorDetails = () => {
    const app = application as ContributorApplication;
    
    return (
      <div className="space-y-4">
        {/* Personal Information */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center text-lg">
                <User className="h-5 w-5 mr-2 text-blue-600" />
                Personal Information
              </CardTitle>
              <Badge className={getTierColor(app.tier)}>
                {app.tier.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Display Name</label>
                <p className="text-lg font-semibold">{app.identity.displayName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p className="text-lg font-semibold flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  {app.identity.email}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Telegram Handle</label>
                <p className="text-lg font-semibold flex items-center">
                  <Phone className="h-4 w-4 mr-2" />
                  {app.identity.telegramHandle}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Country/Region</label>
                <p className="text-lg font-semibold flex items-center">
                  <MapPin className="h-4 w-4 mr-2" />
                  {app.identity.countryRegion}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-muted-foreground">Languages</label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {app.identity.languages.map((lang, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {lang}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Social Media Channels */}
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-lg">
              <Globe className="h-5 w-5 mr-2 text-green-600" />
              Social Media Channels ({app.channels.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {app.channels.map((channel, index) => (
                <div key={index} className="p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-lg">{channel.platform}</span>
                      <Badge className={getStatusColor(channel.verificationStatus || 'pending')}>
                        {channel.verificationStatus || 'pending'}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = channel.url.startsWith('http')
                          ? channel.url
                          : `https://${channel.url}`;
                        window.open(url, '_blank');
                      }}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      View
                    </Button>

                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Followers</label>
                      <p className="text-lg font-semibold">{channel.followers.toLocaleString()}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Avg Views (30d)</label>
                      <p className="text-lg font-semibold">{channel.avgViews30d?.toLocaleString() || 'N/A'}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Content Focus</label>
                      <p className="text-sm">{channel.contentFocus}</p>
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-muted-foreground">Top Audience Geos</label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {channel.audienceTop3Geos.map((geo, geoIndex) => (
                          <Badge key={geoIndex} variant="outline" className="text-xs">
                            {geo}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Wallet Addresses */}
        {app.wallets && app.wallets.length > 0 && (
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center text-lg">
                <CreditCard className="h-5 w-5 mr-2 text-purple-600" />
                Wallet Addresses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {app.wallets.map((wallet, index) => (
                  <div key={index} className="p-3 border rounded-lg bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{wallet.chain}</p>
                        <p className="text-sm text-muted-foreground font-mono">{wallet.address}</p>
                      </div>
                      <Button size="sm" variant="outline">
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  const renderFiles = () => {
    if (type === 'institutional') {
      const app = application as InstitutionalApplication;
      const regulatoryDocs = app.attachments?.regulatoryDocuments || [];
      
      if (regulatoryDocs.length === 0) {
        return (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No files uploaded</p>
          </div>
        );
      }

      return (
        <div className="space-y-6">
          {/* Regulatory Documents */}
          {regulatoryDocs.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold mb-3 flex items-center">
                <Shield className="h-5 w-5 mr-2 text-blue-600" />
                Regulatory Documents ({regulatoryDocs.length})
              </h4>
              <div className="grid gap-4">
                {regulatoryDocs.map((file, index) => (
                  <div key={index} className="group p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-blue-300 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                          {getFileIcon(file.name)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">{file.name}</p>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            <span>•</span>
                            <span>{formatDate(file.uploadedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(file.url, '_blank')}
                          className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = file.url;
                            link.download = file.name;
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="hover:bg-green-50 hover:border-green-300 hover:text-green-600"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    } else {
      // Contributor Application
      const app = application as ContributorApplication;
      const portfolioFiles = app.attachments?.portfolioFiles || [];
      
      if (portfolioFiles.length === 0) {
        return (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No files uploaded</p>
          </div>
        );
      }

      return (
        <div className="space-y-6">
          {/* Portfolio Files */}
          {portfolioFiles.length > 0 && (
            <div>
              <h4 className="text-lg font-semibold mb-3 flex items-center">
                <FileText className="h-5 w-5 mr-2 text-green-600" />
                Portfolio Files ({portfolioFiles.length})
              </h4>
              <div className="grid gap-4">
                {portfolioFiles.map((file, index) => (
                  <div key={index} className="group p-4 bg-white border border-gray-200 rounded-xl hover:shadow-md hover:border-green-300 transition-all duration-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="p-3 bg-green-50 rounded-lg group-hover:bg-green-100 transition-colors">
                          {getFileIcon(file.name)}
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">{file.name}</p>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-500">
                            <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                            <span>•</span>
                            <span>{formatDate(file.uploadedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => window.open(file.url, '_blank')}
                          className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = file.url;
                            link.download = file.name;
                            link.target = '_blank';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          }}
                          className="hover:bg-green-50 hover:border-green-300 hover:text-green-600"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        {/* Header with gradient background */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                {type === 'institutional' ? (
                  <Building2 className="h-8 w-8" />
                ) : (
                  <User className="h-8 w-8" />
                )}
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold text-white">
                  {type === 'institutional' ? 'Institutional' : 'Contributor'} Application
                </DialogTitle>
                <p className="text-blue-100 mt-1">
                  {type === 'institutional' 
                    ? (application as InstitutionalApplication).organizationProfile.legalEntityName
                    : (application as ContributorApplication).identity.displayName
                  }
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onClose}
              className="text-white border-white/30 hover:bg-white/20"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Status and quick actions */}
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center space-x-4">
              <Badge className={`${getStatusColor(application.status)} text-white border-white/30 bg-white/20`}>
                {application.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <div className="flex items-center space-x-2 text-blue-100">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">Submitted {formatDateTime(application.createdAt)}</span>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button
                size="sm"
                onClick={() => handleStatusUpdate('approved')}
                disabled={application.status === 'approved' || isUpdating}
                className="bg-green-500 hover:bg-green-600 text-white border-0 shadow-lg"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleStatusUpdate('declined')}
                disabled={application.status === 'declined' || isUpdating}
                className="border-white/30 text-white hover:bg-white/20"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Decline
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 min-h-0">

          {/* Enhanced Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="flex items-center justify-between">
              <TabsList className="grid w-full max-w-md grid-cols-3 bg-gray-100 p-1 rounded-lg">
                <TabsTrigger 
                  value="overview" 
                  className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <Eye className="h-4 w-4" />
                  <span>Overview</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="files" 
                  className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <FileText className="h-4 w-4" />
                  <span>Files</span>
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {type === 'institutional' 
                      ? (application as InstitutionalApplication).attachments?.regulatoryDocuments?.length || 0
                      : (application as ContributorApplication).attachments?.portfolioFiles?.length || 0
                    }
                  </Badge>
                </TabsTrigger>
                <TabsTrigger 
                  value="actions" 
                  className="flex items-center space-x-2 data-[state=active]:bg-white data-[state=active]:shadow-sm"
                >
                  <Shield className="h-4 w-4" />
                  <span>Actions</span>
                </TabsTrigger>
              </TabsList>
              
              {/* Quick stats */}
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span>Application ID: {application.id?.slice(-8)}</span>
                </div>
                {application.lastReviewedBy && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span>Last reviewed by {application.lastReviewedBy}</span>
                  </div>
                )}
              </div>
            </div>

            <TabsContent value="overview" className="space-y-3">
              {type === 'institutional' ? renderInstitutionalDetails() : renderContributorDetails()}
            </TabsContent>

            <TabsContent value="files" className="space-y-6">
              <Card className="border-0 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100">
                  <CardTitle className="flex items-center text-xl">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <FileText className="h-6 w-6 text-blue-600" />
                    </div>
                    Uploaded Files
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {renderFiles()}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="actions" className="space-y-3">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Shield className="h-5 w-5 mr-2" />
                    Review Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Reviewer Notes</label>
                    <Textarea
                      placeholder="Add your review notes here..."
                      value={reviewerNotes}
                      onChange={(e) => setReviewerNotes(e.target.value)}
                      className="min-h-[120px] mt-2"
                    />
                  </div>
                  
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => handleStatusUpdate('approved')}
                      disabled={application.status === 'approved' || isUpdating}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve Application
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleStatusUpdate('declined')}
                      disabled={application.status === 'declined' || isUpdating}
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Decline Application
                    </Button>
                  </div>

                  {application.reviewerNotes && (
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <h4 className="font-medium mb-2">Previous Review Notes</h4>
                      <p className="text-sm text-muted-foreground">{application.reviewerNotes}</p>
                      {application.lastReviewedBy && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Reviewed by {application.lastReviewedBy} on {formatDateTime(application.lastReviewedAt)}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
