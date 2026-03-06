"use client";

import { Menu, Search, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface AdminHeaderProps {
  onMenuClick: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const [user, setUser] = useState<{ email: string | null } | null>(null);
  const [who, setWho] = useState<{ email?: string; isSuperAdmin?: boolean } | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      
      if (user) {
        try {
          const idToken = await user.getIdToken(true);
          const res = await fetch("/api/admin/whoami", {
            headers: { Authorization: `Bearer ${idToken}` },
            cache: "no-store",
          });
          const data = await res.json().catch(() => null);
          if (data) {
            setWho(data);
          }
        } catch {
          setWho(null);
        }
      } else {
        setWho(null);
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
    <header className="fixed top-0 right-0 left-0 lg:left-64 z-40 bg-white shadow-sm border-b border-gray-200">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left side */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuClick}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          {/* Search */}
          <div className="hidden md:block ml-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="text"
                placeholder="Search submissions..."
                className="pl-10 w-64"
              />
            </div>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center space-x-4">
          {/* User menu */}
          <div className="flex items-center space-x-3">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium text-gray-900">
                {who?.email || user?.email || "Admin User"}
              </p>
              <p className="text-xs text-gray-500">
                {who?.isSuperAdmin ? 'Super Admin' : 'Admin'}
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full"
              onClick={handleLogout}
              title="Sign Out"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
