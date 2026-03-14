'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailLink, sendSignInLinkToEmail, signInWithPopup, GoogleAuthProvider, isSignInWithEmailLink } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, ArrowLeft } from 'lucide-react';
import { FcGoogle } from 'react-icons/fc';

interface LoginPageProps {
  params: Promise<{ locale: string }>;
}

export default function LoginPage({ params }: LoginPageProps) {
  const [, setUser] = useState<{ email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [locale, setLocale] = useState('en');
  const router = useRouter();

  useEffect(() => {
    params.then(({ locale: paramLocale }) => {
      setLocale(paramLocale);
    });
  }, [params]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Check if user is admin
        try {
          const idToken = await user.getIdToken(true);
          const res = await fetch("/api/admin/whoami", {
            headers: { Authorization: `Bearer ${idToken}` },
            cache: "no-store",
          });
          const data = await res.json().catch(() => null);
          if (data && data.isAdmin) {
            router.push('/admin');
            return;
          }
        } catch (error) {
          console.error('Error checking admin status:', error);
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

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

  const goBack = () => {
    router.push(`/${locale}`);
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

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Button
            onClick={goBack}
            variant="ghost"
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Asset Registration
          </Button>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Admin Sign In
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to access the admin dashboard
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
                  placeholder="frank@agvnexrur.ai"
                  value={email}
                  className="text-black"
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
      </div>
    </div>
  );
}
