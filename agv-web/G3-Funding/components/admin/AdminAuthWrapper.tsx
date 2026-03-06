'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailLink, sendSignInLinkToEmail, signOut, signInWithPopup, GoogleAuthProvider, isSignInWithEmailLink } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Shield } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { toast } from 'sonner';

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
  const [user, setUser] = useState<any>(null);
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
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
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
    const handleMagicLink = async () => {
      // Check if this is a magic link URL
      if (isSignInWithEmailLink(auth, window.location.href)) {
        try {
          // Get the email if stored locally
          const email = window.localStorage.getItem('g3_admin_email_for_signin');
          
          if (email) {
            // Sign in with the email link
            await signInWithEmailLink(auth, email, window.location.href);
            // Clear the email from storage
            window.localStorage.removeItem('g3_admin_email_for_signin');
            
            // Check if email is authorized before showing success
            try {
              const idToken = await auth.currentUser?.getIdToken(true);
              const res = await fetch("/api/admin/whoami", {
                headers: { Authorization: `Bearer ${idToken}` },
                cache: "no-store",
              });
              const data = await res.json();
              
              if (data.isAdmin) {
                toast.success('Successfully signed in!');
              } else {
                toast.error('Access denied. Your email is not authorized for admin access.');
                await signOut(auth);
              }
            } catch (error) {
              toast.error('Failed to verify admin access');
              await signOut(auth);
            }
          } else {
            // If no email stored, prompt user to enter email
            const email = window.prompt('Please provide your email for confirmation');
            if (email) {
              await signInWithEmailLink(auth, email, window.location.href);
              
              // Check if email is authorized before showing success
              try {
                const idToken = await auth.currentUser?.getIdToken(true);
                const res = await fetch("/api/admin/whoami", {
                  headers: { Authorization: `Bearer ${idToken}` },
                  cache: "no-store",
                });
                const data = await res.json();
                
                if (data.isAdmin) {
                  toast.success('Successfully signed in!');
                } else {
                  toast.error('Access denied. Your email is not authorized for admin access.');
                  await signOut(auth);
                }
              } catch (error) {
                toast.error('Failed to verify admin access');
                await signOut(auth);
              }
            } else {
              toast.error('Email is required to complete sign-in');
            }
          }
        } catch (error: any) {
          console.error('Magic link sign-in error:', error);
          toast.error('Failed to sign in with magic link', { description: error.message });
        }
      }
    };

    handleMagicLink();
  }, []);

  const sendMagicLink = async () => {
    const emailValue = email.trim();
    if (!emailValue) return toast.error("Enter your email");
    
    try {
      setSendingLink(true);
      const actionCodeSettings = {
        url: `${window.location.origin}/admin`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, emailValue, actionCodeSettings);
      window.localStorage.setItem("g3_admin_email_for_signin", emailValue);
      setLinkSentTo(emailValue);
      toast.success("Magic link sent", { description: `Check ${emailValue}` });
    } catch (e: any) {
      toast.error("Failed to send magic link", { description: e?.message });
    } finally {
      setSendingLink(false);
    }
  };

  const signInWithGoogle = async () => {
    if (isSigningIn) return; // Prevent multiple clicks
    
    try {
      setIsSigningIn(true);
      const provider = new GoogleAuthProvider();
      
      // Add custom parameters
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      // Use popup with better error handling
      await signInWithPopup(auth, provider);
      toast.success("Signed in with Google");
    } catch (e: any) {
      console.error('Google sign-in error:', e);
      
      // Provide more specific error messages
      if (e.code === 'auth/popup-blocked') {
        toast.error("Popup blocked", { 
          description: "Please allow popups for this site and try again." 
        });
      } else if (e.code === 'auth/popup-closed-by-user') {
        toast.error("Sign-in cancelled", { 
          description: "You closed the sign-in window. Please try again." 
        });
      } else if (e.code === 'auth/network-request-failed') {
        toast.error("Network error", { 
          description: "Please check your internet connection and try again." 
        });
      } else {
        toast.error("Google sign-in failed", { description: e?.message || 'Unknown error occurred' });
      }
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

  // Show authentication form if not authenticated or not admin
  if (!who.authed || !who.isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Admin Authentication</CardTitle>
            <CardDescription>
              {who.authed 
                ? "Your email is not authorized to access the admin dashboard"
                : "Sign in to access the admin dashboard"
              }
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {who.authed && !who.isAdmin ? (
              <div className="text-center space-y-4">
                <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                  <p className="text-sm text-yellow-800">
                    Signed in as: <strong>{who.email}</strong>
                  </p>
                  <p className="text-sm text-yellow-700 mt-1">
                    Contact an administrator to request access.
                  </p>
                </div>
                <Button 
                  onClick={() => signOut(auth)}
                  variant="outline"
                  className="w-full"
                >
                  Sign Out
                </Button>
              </div>
            ) : linkSentTo ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-800">Check Your Email</h3>
                  <p className="text-green-600">
                    We&apos;ve sent a sign-in link to <strong>{linkSentTo}</strong>
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setLinkSentTo('');
                    setEmail('');
                  }}
                  className="w-full"
                >
                  Try Different Email
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Google Sign-In Button */}
                <Button 
                  onClick={signInWithGoogle}
                  variant="outline"
                  className="w-full"
                  disabled={isSigningIn}
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    <>
                      <FcGoogle className="h-4 w-4 mr-2" />
                      Continue with Google
                    </>
                  )}
                </Button>

                {/* Divider */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">Or</span>
                  </div>
                </div>

                {/* Email Sign-In */}
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={sendingLink}
                  />
                </div>

                <Button 
                  onClick={sendMagicLink}
                  className="w-full" 
                  disabled={sendingLink || !email.trim()}
                >
                  {sendingLink ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4 mr-2" />
                      Send Sign-In Link
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show authenticated admin content - just pass through to AdminLayout
  return <>{children}</>;
}
