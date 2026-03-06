'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { getRedirectResult, signInWithEmailLink, isSignInWithEmailLink } from 'firebase/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Processing authentication...');
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check if this is a magic link
        if (isSignInWithEmailLink(auth, window.location.href)) {
          const email = window.localStorage.getItem('g3_email_for_signin');
          
          if (email) {
            await signInWithEmailLink(auth, email, window.location.href);
            window.localStorage.removeItem('g3_email_for_signin');
            setStatus('success');
            setMessage('Successfully signed in! Redirecting to dashboard...');
            
            setTimeout(() => {
              router.push('/kol-dashboard');
            }, 2000);
            return;
          } else {
            setStatus('error');
            setMessage('Email not found. Please try signing in again.');
            setTimeout(() => {
              router.push('/kol-dashboard');
            }, 3000);
            return;
          }
        }

        // Handle other auth methods
        const result = await getRedirectResult(auth);
        
        if (result) {
          setStatus('success');
          setMessage('Successfully signed in! Redirecting to dashboard...');
          
          // Redirect to dashboard after a short delay
          setTimeout(() => {
            router.push('/kol-dashboard');
          }, 2000);
        } else {
          setStatus('error');
          setMessage('No authentication result found. Please try again.');
          
          // Redirect to login after a delay
          setTimeout(() => {
            router.push('/kol-dashboard');
          }, 3000);
        }
      } catch (error: any) {
        console.error('Auth callback error:', error);
        setStatus('error');
        setMessage(`Authentication failed: ${error.message}`);
        
        // Redirect to login after a delay
        setTimeout(() => {
          router.push('/kol-dashboard');
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            {status === 'loading' && <Loader2 className="h-8 w-8 animate-spin text-primary" />}
            {status === 'success' && <CheckCircle className="h-8 w-8 text-green-600" />}
            {status === 'error' && <XCircle className="h-8 w-8 text-red-600" />}
          </div>
          <CardTitle className="text-2xl">
            {status === 'loading' && 'Authenticating...'}
            {status === 'success' && 'Success!'}
            {status === 'error' && 'Error'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
