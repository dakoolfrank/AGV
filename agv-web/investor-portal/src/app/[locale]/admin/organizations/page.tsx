'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FiRefreshCw, FiSearch, FiShield, FiUserCheck } from 'react-icons/fi';
import { authedFetch } from '@/lib/admin-client';

type OrganizationStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

interface OrganizationRecord {
  id: string;
  name: string;
  domain: string;
  primaryEmail: string;
  contactName?: string | null;
  status: OrganizationStatus;
  createdAt?: { toDate: () => Date } | null;
  approvedAt?: { toDate: () => Date } | null;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const response = await authedFetch('/api/admin/organizations', { cache: 'no-store' });
      const data: OrganizationRecord[] = await response.json();
      setOrganizations(data);
    } catch (error) {
      console.error('Failed to load organizations', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrganizationStatus = async (id: string, status: OrganizationStatus) => {
    try {
      setUpdatingId(id);
      await authedFetch(`/api/admin/organizations/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await fetchOrganizations();
    } catch (error) {
      console.error('Failed to update organization status', error);
    } finally {
      setUpdatingId(null);
    }
  };

  const filteredOrganizations = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return organizations.filter((org) => {
      return (
        org.name.toLowerCase().includes(term) ||
        org.domain.toLowerCase().includes(term) ||
        org.primaryEmail.toLowerCase().includes(term)
      );
    });
  }, [organizations, searchTerm]);

  const statusBadge = (status: OrganizationStatus) => {
    const baseClass = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium';
    switch (status) {
      case 'approved':
        return <span className={`${baseClass} bg-green-100 text-green-800`}>Approved</span>;
      case 'pending':
        return <span className={`${baseClass} bg-yellow-100 text-yellow-800`}>Pending</span>;
      case 'rejected':
        return <span className={`${baseClass} bg-red-100 text-red-800`}>Rejected</span>;
      case 'suspended':
        return <span className={`${baseClass} bg-gray-200 text-gray-800`}>Suspended</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Organizations</h1>
          <p className="text-gray-600 mt-2">
            Review organization access requests and control dataroom eligibility.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchOrganizations}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <FiRefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid gap-4 md:flex md:items-center md:justify-between">
          <div className="max-w-md w-full">
            <label className="block text-sm font-medium text-gray-700 mb-2">Search</label>
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name, domain, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>

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
                  Organization
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Domain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrganizations.map((org) => (
                <tr key={org.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{org.name}</div>
                    {org.contactName && (
                      <div className="text-sm text-gray-500 flex items-center gap-1">
                        <FiUserCheck className="h-4 w-4" />
                        {org.contactName}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{org.domain}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{org.primaryEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">{statusBadge(org.status)}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <button
                        disabled={updatingId === org.id}
                        onClick={() => updateOrganizationStatus(org.id, 'approved')}
                        className="inline-flex items-center px-3 py-1 border border-green-600 text-green-700 text-sm font-medium rounded-md hover:bg-green-50 disabled:opacity-50"
                      >
                        <FiShield className="mr-2 h-4 w-4" />
                        Approve
                      </button>
                      <button
                        disabled={updatingId === org.id}
                        onClick={() => updateOrganizationStatus(org.id, 'rejected')}
                        className="inline-flex items-center px-3 py-1 border border-red-600 text-red-700 text-sm font-medium rounded-md hover:bg-red-50 disabled:opacity-50"
                      >
                        Reject
                      </button>
                      <button
                        disabled={updatingId === org.id}
                        onClick={() => updateOrganizationStatus(org.id, 'suspended')}
                        className="inline-flex items-center px-3 py-1 border border-gray-400 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 disabled:opacity-50"
                      >
                        Suspend
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredOrganizations.length === 0 && (
          <div className="text-center py-10">
            <FiShield className="mx-auto h-10 w-10 text-gray-400" />
            <h3 className="mt-3 text-sm font-medium text-gray-900">No organizations found</h3>
            <p className="mt-1 text-sm text-gray-500">
              New organization registration requests will appear here automatically.
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}

