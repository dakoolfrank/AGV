'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailLink, sendSignInLinkToEmail, signOut, signInWithPopup, GoogleAuthProvider, isSignInWithEmailLink } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { KOLProfile } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, User, LogOut, ArrowRight } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';
import { toast } from 'sonner';

interface KOLAuthWrapperProps {
  children: React.ReactNode;
}

export function KOLAuthWrapper({ children }: KOLAuthWrapperProps) {
  const [user, setUser] = useState<any>(null);
  const [kolProfile, setKolProfile] = useState<KOLProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Fetch KOL profile by email since KOL ID is different from user UID
        try {
          // First try to find by user UID (in case it matches)
          let kolDoc = await getDoc(doc(db, 'kol_profiles', user.uid));
          
          if (!kolDoc.exists() && user.email) {
            // If not found by UID, search by email
            const { query, collection, where, getDocs } = await import('firebase/firestore');
            const q = query(
              collection(db, 'kol_profiles'),
              where('email', '==', user.email)
            );
            const querySnapshot = await getDocs(q);
            
            if (!querySnapshot.empty) {
              const doc = querySnapshot.docs[0];
              kolDoc = { exists: () => true, id: doc.id, data: () => doc.data() } as any;
            }
          }
          
          if (kolDoc.exists()) {
            const profile = { id: kolDoc.id, ...kolDoc.data() } as KOLProfile;
            setKolProfile(profile);
            setIsAuthenticated(true);
          } else {
            setKolProfile(null);
            setIsAuthenticated(false);
          }
        } catch (error) {
          console.error('Error fetching KOL profile:', error);
          setKolProfile(null);
          setIsAuthenticated(false);
        }
      } else {
        setKolProfile(null);
        setIsAuthenticated(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Add a function to refresh KOL profile (useful after registration)
  const refreshKOLProfile = useCallback(async () => {
    if (user) {
      try {
        // First try to find by user UID (in case it matches)
        let kolDoc = await getDoc(doc(db, 'kol_profiles', user.uid));
        
        if (!kolDoc.exists() && user.email) {
          // If not found by UID, search by email
          const { query, collection, where, getDocs } = await import('firebase/firestore');
          const q = query(
            collection(db, 'kol_profiles'),
            where('email', '==', user.email.toLowerCase())
          );
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            const doc = querySnapshot.docs[0];
            kolDoc = { exists: () => true, id: doc.id, data: () => doc.data() } as any;
          }
        }
        
        if (kolDoc.exists()) {
          const profile = { id: kolDoc.id, ...kolDoc.data() } as KOLProfile;
          setKolProfile(profile);
          setIsAuthenticated(true);
          return true;
        } else {
          setKolProfile(null);
          setIsAuthenticated(false);
          return false;
        }
      } catch (error) {
        console.error('Error refreshing KOL profile:', error);
        setKolProfile(null);
        setIsAuthenticated(false);
        return false;
      }
    }
    return false;
  }, [user]);

  // Handle magic link authentication
  useEffect(() => {
    const handleMagicLink = async () => {
      // Check if this is a magic link URL
      if (isSignInWithEmailLink(auth, window.location.href)) {
        try {
          // Get the email if stored locally
          const email = window.localStorage.getItem('g3_email_for_signin');
          
          if (email) {
            // Sign in with the email link
            await signInWithEmailLink(auth, email, window.location.href);
            // Clear the email from storage
            window.localStorage.removeItem('g3_email_for_signin');
            toast.success('Successfully signed in!');
          } else {
            // If no email stored, prompt user to enter email
            const email = window.prompt('Please provide your email for confirmation');
            if (email) {
              await signInWithEmailLink(auth, email, window.location.href);
              toast.success('Successfully signed in!');
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

  // Auto-refresh when user returns to the page (useful after completing registration)
  useEffect(() => {
    const handleFocus = () => {
      if (user && !kolProfile) {
        // If user is logged in but no KOL profile, try to refresh
        refreshKOLProfile();
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [user, kolProfile, refreshKOLProfile]);

  const sendMagicLink = async () => {
    const emailValue = email.trim();
    if (!emailValue) return toast.error("Enter your email");
    
    try {
      setSendingLink(true);
      const actionCodeSettings = {
        url: `${window.location.origin}/en/auth/callback`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, emailValue, actionCodeSettings);
      window.localStorage.setItem("g3_email_for_signin", emailValue);
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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setIsAuthenticated(false);
      router.push('/');
    } catch (error) {
      console.error('Logout error:', error);
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
  if (!isAuthenticated) {
    // If user is logged in but no KOL profile, redirect to registration
    if (user && !kolProfile) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Welcome, {user.displayName || user.email}!</CardTitle>
              <CardDescription>
                You&apos;re signed in but don&apos;t have a KOL profile yet. Complete your registration to access the dashboard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button 
                onClick={() => router.push('/contributor-application')}
                className="w-full"
                size="lg"
              >
                Complete Registration
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button 
                variant="outline"
                onClick={async () => {
                  const refreshed = await refreshKOLProfile();
                  if (refreshed) {
                    toast.success("Profile updated! Welcome to the dashboard.");
                  } else {
                    toast.error("No KOL profile found. Please complete registration first.");
                  }
                }}
                className="w-full"
              >
                Check Registration Status
              </Button>
              <Button 
                variant="outline"
                onClick={handleLogout}
                className="w-full"
              >
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">KOL Authentication</CardTitle>
            <CardDescription>
              Enter your email to receive a passwordless sign-in link
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            {linkSentTo ? (
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
                    placeholder="your@email.com"
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

  // Show authenticated content
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with user info and logout */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-primary">
                Welcome, {kolProfile?.displayName || 'KOL'}
              </h1>
              <p className="text-sm text-primary/70">
                {(kolProfile as any)?.role === 'agent' || 
                 (kolProfile as any)?.type === 'agent' || 
                 (kolProfile as any)?.agentType !== undefined ||
                 (kolProfile as any)?.agentLevel !== undefined ||
                 (kolProfile as any)?.sGVTBalance !== undefined 
                  ? 'Agent Dashboard' 
                  : 'KOL Dashboard'}
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </Button>
        </div>
      </div>
      
      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}
