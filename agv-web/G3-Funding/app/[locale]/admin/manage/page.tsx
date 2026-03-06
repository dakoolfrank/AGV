'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { toast } from 'sonner';
import { AdminAuthWrapper } from '@/components/admin/AdminAuthWrapper';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { ErrorBoundary } from '@/components/admin/ErrorBoundary';
import { Shield, UserPlus, Users } from 'lucide-react';
import { auth } from '@/lib/firebase';

function AdminManagementContent() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('admin');
  const [isLoading, setIsLoading] = useState(false);

  const handleGrantAdmin = async () => {
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    try {
      setIsLoading(true);
      
      // Get the current user's ID token
      const user = auth.currentUser;
      
      if (!user) {
        toast.error('You must be signed in to grant admin access');
        return;
      }
      
      const idToken = await user.getIdToken(true);
      
      const response = await fetch('/api/admin/grant-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: email.trim(), role }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(data.message);
        setEmail('');
        setRole('admin');
      } else {
        toast.error(data.error || 'Failed to grant admin access');
      }
    } catch (error) {
      console.error('Error granting admin access:', error);
      toast.error('Failed to grant admin access');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ErrorBoundary>
      <AdminLayout title="Admin Management" description="Manage admin access and permissions">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Grant Admin Access</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </Select>
                </div>
              </div>
              <Button 
                onClick={handleGrantAdmin}
                disabled={isLoading || !email.trim()}
                className="w-full md:w-auto"
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Granting Access...
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Grant Admin Access
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="h-5 w-5" />
                <span>Admin Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-900 mb-2">How to Grant Admin Access</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Enter the email address of the user you want to grant admin access to</li>
                    <li>Select the appropriate role (Admin or Super Admin)</li>
                    <li>Click "Grant Admin Access"</li>
                    <li>The user will need to sign in with their email to access the admin dashboard</li>
                  </ol>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <h4 className="font-medium text-yellow-900 mb-2">Role Permissions</h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li><strong>Admin:</strong> Can access all admin pages and manage applications</li>
                    <li><strong>Super Admin:</strong> Can grant admin access to other users and manage all admin functions</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdminLayout>
    </ErrorBoundary>
  );
}

export default function AdminManagementPage() {
  return (
    <AdminAuthWrapper>
      <AdminManagementContent />
    </AdminAuthWrapper>
  );
}
