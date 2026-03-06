'use client';

import React from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FiLock } from 'react-icons/fi';
import Button from './Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const params = useParams();
  const locale = (params.locale as string) || 'en';
  const { isAuthenticated, hasAccess, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#223256]/5 to-[#4FACFE]/5 py-12 px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-[#223256] to-[#4FACFE] rounded-full flex items-center justify-center mx-auto mb-4">
            <FiLock className="h-8 w-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Required</h2>
          <p className="text-gray-600 mb-6">
            Please sign in to access protected investor documents.
          </p>
          <Button onClick={() => router.push(`/${locale}/login`)} variant="primary" size="lg" className="w-full">
            Sign In
          </Button>
          <p className="mt-4 text-sm text-gray-500">
            Don&apos;t have an account?{' '}
            <button
              onClick={() => router.push(`/${locale}/register`)}
              className="text-primary hover:underline font-medium"
            >
              Register your organization
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (!hasAccess && isAuthenticated) {
    // Redirect to login page with pending status - login page will show toast
    router.push(`/${locale}/login?status=pending`);
    return null;
  }

  return <>{children}</>;
}
