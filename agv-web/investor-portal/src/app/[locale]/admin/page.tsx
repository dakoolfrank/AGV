'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiFileText, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { authedFetch } from '@/lib/admin-client';

interface NDARequest {
  id: string;
  name: string;
  title: string;
  organization: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: { toDate: () => Date } | null;
  createdAt: { toDate: () => Date } | null;
  updatedAt: { toDate: () => Date } | null;
}

export default function AdminDashboard() {
  const [ndaRequests, setNdaRequests] = useState<NDARequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0
  });

  useEffect(() => {
    fetchNDARequests();
  }, []);

  const fetchNDARequests = async () => {
    try {
      const response = await authedFetch('/api/admin/nda-requests');
      const requests: NDARequest[] = await response.json();
      
      setNdaRequests(requests.slice(0, 10)); // Limit to 10 for dashboard
      
      // Calculate stats
      const total = requests.length;
      const pending = requests.filter(r => r.status === 'pending').length;
      const approved = requests.filter(r => r.status === 'approved').length;
      const rejected = requests.filter(r => r.status === 'rejected').length;
      
      setStats({ total, pending, approved, rejected });
    } catch (error) {
      console.error('Error fetching NDA requests:', error);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">
          Overview of NDA requests and system activity
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FiFileText className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Requests</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <FiCheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-lg shadow p-6"
        >
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <FiAlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-gray-900">{stats.rejected}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent NDA Requests */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="bg-white rounded-lg shadow"
      >
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent NDA Requests</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Submitted
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ndaRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {request.name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {request.title}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.organization}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {request.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {request.submittedAt?.toDate ? 
                      request.submittedAt.toDate().toLocaleDateString() : 
                      'N/A'
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {ndaRequests.length === 0 && (
          <div className="text-center py-8">
            <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No NDA requests</h3>
            <p className="mt-1 text-sm text-gray-500">
              NDA requests will appear here once submitted.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
