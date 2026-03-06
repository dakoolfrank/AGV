"use client";

import { useState } from "react";
import { Inter } from "next/font/google";
import "../globals.css";
import { Toaster } from "../../components/ui/toaster";
import { AdminSidebar } from "../../components/admin/admin-sidebar";
import { AdminHeader } from "../../components/admin/admin-header";
import { AdminAuthWrapper } from "../../components/admin/AdminAuthWrapper";

const inter = Inter({ subsets: ["latin"] });

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <html lang="en">
      <head>
        <meta name="robots" content="noindex, nofollow" />
      </head>
      <body className={inter.className}>
        <AdminAuthWrapper>
          <div className="min-h-screen bg-gray-50">
            {/* Sidebar */}
            <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
            
            {/* Main Content */}
            <div className="lg:ml-64">
              {/* Header */}
              <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
              
              {/* Page Content */}
              <main className="pt-20 pb-6">
                <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                  {children}
                </div>
              </main>
            </div>
          </div>
        </AdminAuthWrapper>
        <Toaster />
      </body>
    </html>
  );
}
