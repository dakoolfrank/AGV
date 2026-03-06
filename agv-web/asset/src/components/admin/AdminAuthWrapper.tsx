'use client';

import React, { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailLink, sendSignInLinkToEmail, signInWithPopup, GoogleAuthProvider, isSignInWithEmailLink } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, User } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

interface AdminAuthWrapperProps {
  children: React.ReactNode;
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

export function AdminAuthWrapper({ children }: AdminAuthWrapperProps) {
  const [who, setWho] = useState<WhoAmI>({ 
    authed: false, 
    email: null, 
    isAdmin: false, 
    isSuperAdmin: false,
    claims: { role: null, roles: [], admin: false }
  });
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);

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
          if (data) {
            // Log debug info to console
            console.log('Admin Auth Debug Info:', {
              authenticated: data.authed,
              email: data.email,
              isAdmin: data.isAdmin,
              isSuperAdmin: data.isSuperAdmin,
              claims: data.claims
            });
            setWho(data);
          }
        } catch {
          setWho((s) => ({ ...s, isAdmin: false, isSuperAdmin: false }));
        }
      } else {
        setWho({ authed: false, email: null, isAdmin: false, isSuperAdmin: false, claims: { role: null, roles: [], admin: false } });
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle magic link authentication
  useEffect(() => {
    if (isSignInWithEmailLink(auth, window.location.href)) {
      const email = window.localStorage.getItem('emailForSignIn');
      if (email) {
        signInWithEmailLink(auth, email, window.location.href)
          .then(() => {
            window.localStorage.removeItem('emailForSignIn');
            setLinkSentTo('');
          })
          .catch((error) => {
            console.error('Error signing in with email link:', error);
          });
      }
    }
  }, []);

  const sendMagicLink = async () => {
    if (!email) return;
    
    setSendingLink(true);
    try {
      const actionCodeSettings = {
        url: window.location.origin + '/admin',
        handleCodeInApp: true,
      };
      
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem('emailForSignIn', email);
      setLinkSentTo(email);
    } catch (error) {
      console.error('Error sending magic link:', error);
    } finally {
      setSendingLink(false);
    }
  };

  const signInWithGoogle = async () => {
    if (isSigningIn) return;
    
    try {
      setIsSigningIn(true);
      const provider = new GoogleAuthProvider();
      
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      await signInWithPopup(auth, provider);
    } catch (e: unknown) {
      console.error('Google sign-in error:', e);
    } finally {
      setIsSigningIn(false);
    }
  };


  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Show authentication form if not authenticated
  if (!who.authed || !who.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Admin Access Required
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Please sign in with an authorized admin account
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">Sign In</CardTitle>
              <CardDescription className="text-center">
                Choose your preferred sign-in method
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Google Sign In */}
              <Button
                onClick={signInWithGoogle}
                disabled={isSigningIn}
                className="w-full text-black hover:text-gray-500"
                variant="outline"
              >
                {isSigningIn ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FcGoogle className="mr-2 h-4 w-4" />
                )}
                Continue with Google
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    Or continue with email
                  </span>
                </div>
              </div>

              {/* Magic Link */}
              {!linkSentTo ? (
                <div className="space-y-2">
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    type="email"
                    className="text-black"
                    placeholder="admin@agvprotocol.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendMagicLink()}
                  />
                  <Button
                    onClick={sendMagicLink}
                    disabled={sendingLink || !email}
                    className="w-full"
                  >
                    {sendingLink ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Send Magic Link
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-2">
                  <div className="flex items-center justify-center text-green-600">
                    <Mail className="mr-2 h-4 w-4" />
                    Link sent to {linkSentTo}
                  </div>
                  <p className="text-sm text-gray-600">
                    Check your email and click the link to sign in
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setLinkSentTo('')}
                    className="w-full"
                  >
                    Send to different email
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {who.authed && !who.isAdmin && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="text-center text-red-600">
                  <User className="mx-auto h-8 w-8 mb-2" />
                  <p className="font-medium">Access Denied</p>
                  <p className="text-sm">
                    Your account ({who.email}) is not authorized for admin access.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // Show admin interface - just render the children (original layout)
  return <>{children}</>;
}
