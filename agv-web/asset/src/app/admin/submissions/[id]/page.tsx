"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  FileText,
  Building,
  DollarSign,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";

interface BasicData {
  projectName?: string;
  landParcelId?: string;
  landType?: string;
  owner?: string;
  county?: string;
  city?: string;
  province?: string;
  latitude?: string;
  longitude?: string;
  leaseContractId?: string;
  duration?: string;
}

interface FinancialData {
  unitInvestmentCost?: string;
  annualCashFlowBreakdown?: string;
  annualizedIRR?: string;
  [key: string]: string | undefined;
}

interface OperationsCompliance {
  companyName?: string;
  businessLicense?: string;
  epcContractorName?: string;
  governmentFiling?: string;
  operatingEntity?: string;
  tier?: string;
}

interface TierData {
  [key: string]: string | undefined;
}

interface SubmissionData {
  id: string;
  basicData: BasicData;
  financialData: FinancialData;
  operationsCompliance: OperationsCompliance;
  tierData: TierData;
  status: string;
  submittedAt: string;
  attachments?: {
    files: Array<{
      name: string;
      url: string;
      size: number;
      type: string;
      uploadedAt: string;
      field: string;
    }>;
  };
}

export default function SubmissionDetailPage() {
  const params = useParams();
  const [submission, setSubmission] = useState<SubmissionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchSubmission(params.id as string);
    }
  }, [params.id]);

  const fetchSubmission = async (id: string) => {
    try {
      // Get the current user's ID token for authentication
      const user = auth.currentUser;
      if (!user) {
        console.error("No authenticated user found");
        setLoading(false);
        return;
      }

      const idToken = await user.getIdToken();
      const response = await fetch(`/api/assets/${id}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSubmission(data);
      } else if (response.status === 401) {
        console.error("Unauthorized access - user may not have admin privileges");
      } else {
        console.error("Failed to fetch submission");
      }
    } catch (error) {
      console.error("Error fetching submission:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">Rejected</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "rejected":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-yellow-600" />;
    }
  };


  const handleStatusChange = async (newStatus: string) => {
    try {
      // Set loading state
      setActionLoading(true);
      
      // Get the current user's ID token for authentication
      const user = auth.currentUser;
      if (!user) {
        toast.error('No authenticated user found');
        return;
      }

      const idToken = await user.getIdToken();
      
      // Make API call to update the status in Firebase
      const response = await fetch(`/api/assets/${params.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          status: newStatus,
          updatedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        // Update local state only after successful API call
        setSubmission(prev => prev ? { ...prev, status: newStatus } : null);
        
        // Show success message
        toast.success(`Submission ${newStatus} successfully`);
      } else if (response.status === 401) {
        toast.error('Unauthorized access - user may not have admin privileges');
      } else {
        toast.error('Failed to update submission status');
        console.error('Failed to update status:', response.statusText);
      }
    } catch (error) {
      toast.error('Error updating submission status');
      console.error("Error updating status:", error);
    } finally {
      // Clear loading state
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Submission not found.</p>
        <Button asChild className="mt-4">
          <Link href="/admin/submissions">Back to Submissions</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/submissions" className="flex items-center hover:text-gray-600 text-black">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
           <div>
             <h1 className="!text-2xl font-bold text-gray-900">
               {submission.basicData?.projectName || "Submission Details"}
             </h1>
             <p className="text-gray-600">Review submission details and make decisions</p>
           </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {getStatusIcon(submission.status)}
          {getStatusBadge(submission.status)}
        </div>
      </div>

      {/* Action Buttons */}
      {submission.status === "pending" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium">Review Actions</h3>
                <p className="text-sm text-gray-500">Approve or reject this submission</p>
              </div>
               <div className="flex space-x-2">
                 <Button
                   onClick={() => handleStatusChange("approved")}
                   disabled={actionLoading}
                   className="bg-green-600 hover:bg-green-700"
                 >
                   {actionLoading ? (
                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                   ) : (
                     <CheckCircle className="mr-2 h-4 w-4" />
                   )}
                   Approve
                 </Button>
                 <Button
                   onClick={() => handleStatusChange("rejected")}
                   disabled={actionLoading}
                   variant="destructive"
                 >
                   {actionLoading ? (
                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                   ) : (
                     <XCircle className="mr-2 h-4 w-4" />
                   )}
                   Reject
                 </Button>
               </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Building className="mr-2 h-5 w-5" />
            Basic Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Project Name</label>
                <p className="text-sm">{submission.basicData?.projectName || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Land Parcel ID</label>
                <p className="text-sm">{submission.basicData?.landParcelId || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Land Type</label>
                <p className="text-sm">{submission.basicData?.landType || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Owner</label>
                <p className="text-sm">{submission.basicData?.owner || "N/A"}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Location</label>
                <p className="text-sm">
                  {submission.basicData?.county && submission.basicData?.city && submission.basicData?.province
                    ? `${submission.basicData.county}, ${submission.basicData.city}, ${submission.basicData.province}`
                    : "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">GPS Coordinates</label>
                <p className="text-sm">
                  {submission.basicData?.latitude && submission.basicData?.longitude
                    ? `${submission.basicData.latitude}, ${submission.basicData.longitude}`
                    : "N/A"}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Lease Contract ID</label>
                <p className="text-sm">{submission.basicData?.leaseContractId || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Duration</label>
                <p className="text-sm">{submission.basicData?.duration || "N/A"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Financial Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DollarSign className="mr-2 h-5 w-5" />
            Financial Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Unit Investment Cost</label>
                <p className="text-sm">{submission.financialData?.unitInvestmentCost || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Annual Cash Flow Breakdown</label>
                <p className="text-sm">{submission.financialData?.annualCashFlowBreakdown || "N/A"}</p>
              </div>
              {/* Check for file URLs in financial data */}
              {Object.entries(submission.financialData || {}).map(([key, value]) => {
                const isFileUrl = key.toLowerCase().includes('url') || key.toLowerCase().includes('file');
                const isUrl = typeof value === 'string' && (value.startsWith('http') || value.startsWith('https'));
                
                if (isFileUrl && isUrl) {
                  return (
                    <div key={key}>
                      <label className="text-sm font-medium text-gray-500">
                        {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </label>
                      <div className="mt-1">
                        <Button variant="outline" size="sm" asChild className="bg-blue-600 hover:bg-blue-700">
                          <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Document
                          </a>
                        </Button>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Annualized IRR</label>
                <p className="text-sm">{submission.financialData?.annualizedIRR || "N/A"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Operations & Compliance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="mr-2 h-5 w-5" />
            Operations & Compliance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Company Name</label>
                <p className="text-sm">{submission.operationsCompliance?.companyName || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Business License</label>
                <p className="text-sm">{submission.operationsCompliance?.businessLicense || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">EPC Contractor</label>
                <p className="text-sm">{submission.operationsCompliance?.epcContractorName || "N/A"}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Government Filing</label>
                <p className="text-sm">{submission.operationsCompliance?.governmentFiling || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Operating Entity</label>
                <p className="text-sm">{submission.operationsCompliance?.operatingEntity || "N/A"}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">Tier</label>
                <p className="text-sm">{submission.operationsCompliance?.tier || "N/A"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tier-Specific Data */}
      {submission.operationsCompliance?.tier && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              {submission.operationsCompliance.tier}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(submission.tierData || {}).map(([key, value]) => {
                // Check if this is a file URL field
                const isFileUrl = key.toLowerCase().includes('url') || key.toLowerCase().includes('file');
                const isUrl = typeof value === 'string' && (value.startsWith('http') || value.startsWith('https'));
                
                return (
                  <div key={key}>
                    <label className="text-sm font-medium text-gray-500">
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </label>
                    {isFileUrl && isUrl ? (
                      <div className="mt-1">
                        <Button variant="outline" size="sm" asChild className="bg-blue-600 hover:bg-blue-700">
                          <a href={value} target="_blank" rel="noopener noreferrer" className="flex items-center">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View Document
                          </a>
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm">{String(value) || "N/A"}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
