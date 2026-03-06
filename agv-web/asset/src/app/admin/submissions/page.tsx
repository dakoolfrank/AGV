"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
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

interface OperationsCompliance {
  companyName?: string;
  businessLicense?: string;
  epcContractorName?: string;
  governmentFiling?: string;
  operatingEntity?: string;
  tier?: string;
}

interface Submission {
  id: string;
  projectName: string;
  companyName: string;
  status: string;
  submittedAt: string;
  tier: string;
  basicData: BasicData;
  operationsCompliance: OperationsCompliance;
}

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [filteredSubmissions, setFilteredSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [loadingStates, setLoadingStates] = useState<{[key: string]: boolean}>({});

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async () => {
    try {
      // Get the current user's ID token for authentication
      const user = auth.currentUser;
      if (!user) {
        console.error("No authenticated user found");
        setLoading(false);
        return;
      }

      const idToken = await user.getIdToken();
      const response = await fetch("/api/assets", {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        const assets = data.assets || [];
        
        const formattedSubmissions = assets.map((asset: {
          id: string;
          basicData?: BasicData;
          operationsCompliance?: OperationsCompliance;
          status?: string;
          submittedAt: string | { _seconds: number };
        }) => ({
          id: asset.id,
          projectName: asset.basicData?.projectName || "N/A",
          companyName: asset.operationsCompliance?.companyName || "N/A",
          status: asset.status || "pending",
          submittedAt: asset.submittedAt, // Keep as-is to handle Firebase Timestamp
          tier: asset.operationsCompliance?.tier || "N/A",
          basicData: asset.basicData,
          operationsCompliance: asset.operationsCompliance,
        }));

        setSubmissions(formattedSubmissions);
      } else if (response.status === 401) {
        console.error("Unauthorized access - user may not have admin privileges");
      } else {
        console.error("Failed to fetch submissions:", response.statusText);
      }
    } catch (error) {
      console.error("Error fetching submissions:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterSubmissions = useCallback(() => {
    let filtered = submissions;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (submission) =>
          submission.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
          submission.companyName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((submission) => submission.status === statusFilter);
    }

    // Tier filter
    if (tierFilter !== "all") {
      filtered = filtered.filter((submission) => submission.tier === tierFilter);
    }

    setFilteredSubmissions(filtered);
  }, [submissions, searchTerm, statusFilter, tierFilter]);

  useEffect(() => {
    filterSubmissions();
  }, [filterSubmissions]);

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
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "rejected":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-600" />;
    }
  };

  const formatDate = (dateInput: string | { _seconds: number } | Date) => {
    let date: Date;
    
    // Handle Firebase Timestamp object
    if (dateInput && typeof dateInput === 'object' && '_seconds' in dateInput && dateInput._seconds) {
      date = new Date(dateInput._seconds * 1000);
    }
    // Handle regular Date string
    else if (typeof dateInput === 'string') {
      date = new Date(dateInput);
    }
    // Handle Date object
    else if (dateInput instanceof Date) {
      date = dateInput;
    }
    // Fallback to current date
    else {
      date = new Date();
    }
    
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const handleStatusChange = async (submissionId: string, newStatus: string) => {
    const loadingKey = `${submissionId}-${newStatus}`;
    
    try {
      // Set loading state
      setLoadingStates(prev => ({ ...prev, [loadingKey]: true }));
      
      // Get the current user's ID token for authentication
      const user = auth.currentUser;
      if (!user) {
        toast.error('No authenticated user found');
        return;
      }

      const idToken = await user.getIdToken();
      
      // Make API call to update the status in Firebase
      const response = await fetch(`/api/assets/${submissionId}`, {
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
        setSubmissions(prev =>
          prev.map(submission =>
            submission.id === submissionId
              ? { ...submission, status: newStatus }
              : submission
          )
        );
        
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
      setLoadingStates(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Submissions</h1>
        <p className="text-gray-600">Manage and review asset registration submissions</p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search submissions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 text-gray-900"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={tierFilter} onValueChange={setTierFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by tier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Tiers</SelectItem>
                <SelectItem value="Orchard Data">Orchard Data</SelectItem>
                <SelectItem value="Solar Data">Solar Data</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" className="justify-start sm:col-span-2 lg:col-span-1">
              <Filter className="mr-2 h-4 w-4" />
              More Filters
            </Button>
          </div>
        </CardContent>
      </Card>

       {/* Submissions Table */}
       <Card>
         <CardHeader>
           <CardTitle>Submissions ({filteredSubmissions.length})</CardTitle>
           <CardDescription>
             Review and manage asset registration submissions
           </CardDescription>
         </CardHeader>
         <CardContent>
           {filteredSubmissions.length > 0 ? (
             <div>
               {/* Desktop Table View */}
               <div className="hidden lg:block">
                 <table className="w-full">
                   <thead>
                     <tr className="border-b border-gray-200">
                       <th className="text-left py-3 px-4 font-medium text-gray-700">Project Name</th>
                       <th className="text-left py-3 px-4 font-medium text-gray-700">Company Name</th>
                       <th className="text-left py-3 px-4 font-medium text-gray-700">Tier</th>
                       <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                       <th className="text-left py-3 px-4 font-medium text-gray-700">Submitted</th>
                       <th className="text-right py-3 px-4 font-medium text-gray-700">Actions</th>
                     </tr>
                   </thead>
                   <tbody>
                     {filteredSubmissions.map((submission) => (
                       <tr key={submission.id} className="border-b border-gray-100 hover:bg-gray-50">
                         <td className="py-4 px-4">
                           <div className="flex items-center space-x-2">
                             {getStatusIcon(submission.status)}
                             <span className="font-medium text-gray-900">{submission.projectName}</span>
                           </div>
                         </td>
                         <td className="py-4 px-4 text-gray-600">
                           {submission.companyName}
                         </td>
                         <td className="py-4 px-4 text-gray-600">
                           {submission.tier}
                         </td>
                         <td className="py-4 px-4">
                           {getStatusBadge(submission.status)}
                         </td>
                         <td className="py-4 px-4 text-gray-500 text-sm">
                           {formatDate(submission.submittedAt)}
                         </td>
                         <td className="py-4 px-4">
                           <div className="flex items-center justify-start space-x-2">
                             <Button variant="outline" size="sm" className="text-black" asChild>
                               <Link href={`/admin/submissions/${submission.id}`} className="flex items-center hover:text-gray-600">
                                 <Eye className="mr-1 h-4 w-4" />
                                 View
                               </Link>
                             </Button>
                             
                             {submission.status === "pending" && (
                               <>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => handleStatusChange(submission.id, "approved")}
                                   disabled={loadingStates[`${submission.id}-approved`] || loadingStates[`${submission.id}-rejected`]}
                                   className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300"
                                 >
                                   {loadingStates[`${submission.id}-approved`] ? (
                                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-1"></div>
                                   ) : (
                                     <CheckCircle className="mr-1 h-4 w-4" />
                                   )}
                                   Approve
                                 </Button>
                                 <Button
                                   variant="outline"
                                   size="sm"
                                   onClick={() => handleStatusChange(submission.id, "rejected")}
                                   disabled={loadingStates[`${submission.id}-approved`] || loadingStates[`${submission.id}-rejected`]}
                                   className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300"
                                 >
                                   {loadingStates[`${submission.id}-rejected`] ? (
                                     <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-1"></div>
                                   ) : (
                                     <XCircle className="mr-1 h-4 w-4" />
                                   )}
                                   Reject
                                 </Button>
                               </>
                             )}
                           </div>
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
               </div>

               {/* Mobile Card View */}
               <div className="lg:hidden space-y-4">
                 {filteredSubmissions.map((submission) => (
                   <Card key={submission.id} className="border border-gray-200">
                     <CardContent className="p-4">
                       <div className="space-y-3">
                         {/* Header with status icon and project name */}
                         <div className="flex items-start justify-between">
                           <div className="flex items-center space-x-2 flex-1 min-w-0">
                             {getStatusIcon(submission.status)}
                             <h3 className="font-medium text-gray-900 truncate">{submission.projectName}</h3>
                           </div>
                           {getStatusBadge(submission.status)}
                         </div>

                         {/* Company and Tier */}
                         <div className="space-y-2">
                           <div className="flex justify-between items-center">
                             <span className="text-sm text-gray-500">Company:</span>
                             <span className="text-sm text-gray-900 font-medium">{submission.companyName}</span>
                           </div>
                           <div className="flex justify-between items-center">
                             <span className="text-sm text-gray-500">Tier:</span>
                             <span className="text-sm text-gray-900 font-medium">{submission.tier}</span>
                           </div>
                           <div className="flex justify-between items-center">
                             <span className="text-sm text-gray-500">Submitted:</span>
                             <span className="text-sm text-gray-900 font-medium">{formatDate(submission.submittedAt)}</span>
                           </div>
                         </div>

                         {/* Actions */}
                         <div className="flex flex-col space-y-2 pt-2 border-t border-gray-100">
                           <Button variant="outline" size="sm" className="text-black w-full" asChild>
                             <Link href={`/admin/submissions/${submission.id}`} className="flex items-center justify-center hover:text-gray-600">
                               <Eye className="mr-2 h-4 w-4" />
                               View Details
                             </Link>
                           </Button>
                           
                           {submission.status === "pending" && (
                             <div className="flex space-x-2">
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => handleStatusChange(submission.id, "approved")}
                                 disabled={loadingStates[`${submission.id}-approved`] || loadingStates[`${submission.id}-rejected`]}
                                 className="text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 flex-1"
                               >
                                 {loadingStates[`${submission.id}-approved`] ? (
                                   <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-600 mr-2"></div>
                                 ) : (
                                   <CheckCircle className="mr-2 h-4 w-4" />
                                 )}
                                 Approve
                               </Button>
                               <Button
                                 variant="outline"
                                 size="sm"
                                 onClick={() => handleStatusChange(submission.id, "rejected")}
                                 disabled={loadingStates[`${submission.id}-approved`] || loadingStates[`${submission.id}-rejected`]}
                                 className="text-red-600 hover:text-red-700 border-red-200 hover:border-red-300 flex-1"
                               >
                                 {loadingStates[`${submission.id}-rejected`] ? (
                                   <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                                 ) : (
                                   <XCircle className="mr-2 h-4 w-4" />
                                 )}
                                 Reject
                               </Button>
                             </div>
                           )}
                         </div>
                       </div>
                     </CardContent>
                   </Card>
                 ))}
               </div>
             </div>
           ) : (
             <div className="text-center py-8">
               <p className="text-gray-500">No submissions found matching your criteria.</p>
             </div>
           )}
         </CardContent>
       </Card>
    </div>
  );
}
