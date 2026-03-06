'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FiFileText, FiRefreshCw, FiSearch } from 'react-icons/fi';
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

export default function NDARequestsPage() {
  const [ndaRequests, setNdaRequests] = useState<NDARequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchNDARequests();
  }, []);

  const fetchNDARequests = async () => {
    try {
      setLoading(true);
      const response = await authedFetch('/api/admin/nda-requests');
      const requests: NDARequest[] = await response.json();
      setNdaRequests(requests);
    } catch (error) {
      console.error('Error fetching NDA requests:', error);
    } finally {
      setLoading(false);
    }
  };



  const filteredRequests = ndaRequests.filter(request => {
    const matchesSearch = 
      request.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.organization.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

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
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">NDA Requests</h1>
          <p className="text-gray-600 mt-2">
            Manage and review NDA requests from potential investors
          </p>
        </div>
        <button
          onClick={fetchNDARequests}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FiRefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search Filter */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="max-w-md">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Search
          </label>
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, title, organization, or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Requests Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Title
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
              {filteredRequests.map((request) => (
                <tr key={request.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {request.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {request.title}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {request.organization}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {request.email}
                    </div>
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

        {filteredRequests.length === 0 && (
          <div className="text-center py-8">
            <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {searchTerm ? 'No matching requests' : 'No NDA requests'}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm 
                ? 'Try adjusting your search criteria.'
                : 'NDA requests will appear here once submitted.'
              }
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
