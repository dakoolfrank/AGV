'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  FileText, 
  Settings, 
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserCheck,
  XCircle
} from 'lucide-react';

interface AdminSidebarProps {
  className?: string;
}

const navigation = [
  {
    name: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    current: true,
  },
  {
    name: 'Analytics',
    href: '/admin/analytics',
    icon: BarChart3,
    current: false,
  },
  {
    name: 'Institutional Applications',
    href: '/admin/institutional',
    icon: Building2,
    current: false,
  },
  {
    name: 'Contributor Applications',
    href: '/admin/contributor',
    icon: Users,
    current: false,
  },
  {
    name: 'Verification',
    href: '/admin/verification',
    icon: UserCheck,
    current: false,
  },
  {
    name: 'Admin Management',
    href: '/admin/manage',
    icon: Shield,
    current: false,
  },
];

const statusOptions = [
  { value: 'new', label: 'New', icon: FileText, color: 'bg-blue-100 text-blue-800' },
  { value: 'approved', label: 'Approved', icon: UserCheck, color: 'bg-green-100 text-green-800' },
  { value: 'declined', label: 'Declined', icon: XCircle, color: 'bg-red-100 text-red-800' },
];

export function AdminSidebar({ className }: AdminSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div className={cn(
      "flex flex-col h-screen bg-white border-r border-gray-200 transition-all duration-300 fixed left-0 top-0 z-40",
      collapsed ? "w-16" : "w-64",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-xl font-bold text-gray-900">Admin Portal</h1>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="p-1"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-gray-700 hover:bg-gray-100",
                collapsed && "justify-center"
              )}
            >
              <item.icon className={cn("h-5 w-5", !collapsed && "mr-3")} />
              {!collapsed && item.name}
            </Link>
          );
        })}
      </nav>

      {/* Status Legend */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Status Legend
          </h3>
          <div className="space-y-2">
            {statusOptions.map((status) => (
              <div key={status.value} className="flex items-center space-x-2">
                <div className={cn("w-2 h-2 rounded-full", status.color)} />
                <span className="text-xs text-gray-600">{status.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        {!collapsed && (
          <div className="text-xs text-gray-500">
            <p>G3 Funding Admin</p>
            <p>Version 1.0.0</p>
          </div>
        )}
      </div>
    </div>
  );
}
