'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { AdminSidebar } from './AdminSidebar';
import { Button } from '@/components/ui/button';
import { LogOut, Shield } from 'lucide-react';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

interface WhoAmI {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  claims: {
    role: string | null;
    roles: string[];
    admin: boolean;
  };
}

export function AdminLayout({ children, title, description }: AdminLayoutProps) {
  const [who, setWho] = useState<WhoAmI>({ 
    authed: false, 
    email: null, 
    isAdmin: false, 
    isSuperAdmin: false,
    claims: { role: null, roles: [], admin: false }
  });
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Fetch server-verified role
        try {
          const idToken = await user.getIdToken(true);
          const res = await fetch("/api/admin/whoami", {
            headers: { Authorization: `Bearer ${idToken}` },
            cache: "no-store",
          });
          const data = await res.json().catch(() => null);
          if (data) setWho(data);
        } catch {
          setWho((s) => ({ ...s, isAdmin: false, isSuperAdmin: false }));
        }
      } else {
        setWho({ authed: false, email: null, isAdmin: false, isSuperAdmin: false, claims: { role: null, roles: [], admin: false } });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="ml-16 lg:ml-64 flex flex-col min-h-screen transition-all duration-300">
        {/* Top Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              {title && <h1 className="text-2xl font-bold text-gray-900">{title}</h1>}
              {description && <p className="text-gray-600 mt-1">{description}</p>}
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-primary" />
                  <span className="text-sm text-gray-600">
                    {who.email} {who.isSuperAdmin && '(Super Admin)'}
                  </span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center space-x-2"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
