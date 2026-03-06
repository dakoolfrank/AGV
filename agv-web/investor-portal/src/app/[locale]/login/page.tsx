'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { FiMail, FiLock, FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import Button from '@/components/Button';
import Link from 'next/link';
import Toast from '@/components/Toast';

function LoginForm() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const locale = (params.locale as string) || 'en';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'info' | 'success' | 'warning' | 'error'>('warning');
  const [showToast, setShowToast] = useState(false);

  // Check for pending status from URL or auth state
  useEffect(() => {
    const status = searchParams.get('status');
    if (status === 'pending') {
      setToastMessage('Your organization registration is pending approval. You will be notified once your access is approved.');
      setToastType('warning');
      setShowToast(true);
    }

    // Check if user is already authenticated but access is pending
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !status) {
        try {
          const idToken = await user.getIdToken();
          const response = await fetch('/api/auth/check-access', {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (!response.ok) {
            const data = await response.json();
            if (data.status === 'pending') {
              setToastMessage('Your organization registration is pending approval. You will be notified once your access is approved.');
              setToastType('warning');
              setShowToast(true);
              setEmail(user.email || '');
            } else if (data.status === 'rejected') {
              setToastMessage('Your organization registration has been rejected. Please contact support.');
              setToastType('error');
              setShowToast(true);
            } else if (data.status === 'suspended') {
              setToastMessage('Your organization access has been suspended. Please contact support.');
              setToastType('error');
              setShowToast(true);
            }
          }
        } catch (err) {
          console.error('Error checking access:', err);
        }
      }
    });

    return () => unsubscribe();
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const idToken = await userCredential.user.getIdToken();

      // Check user access status
      const response = await fetch('/api/auth/check-access', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.status === 'pending') {
          setError('Your organization registration is pending approval. Please wait for admin approval.');
        } else if (data.status === 'rejected') {
          setError('Your organization registration has been rejected. Please contact support.');
        } else if (data.status === 'suspended') {
          setError('Your organization access has been suspended. Please contact support.');
        } else {
          setError(data.error || 'Access denied. Please contact support.');
        }
        await auth.signOut();
        setLoading(false);
        return;
      }

      // Access granted - redirect to investor dashboard
      router.push(`/${locale}/investor`);
    } catch (error: unknown) {
      console.error('Login error:', error);
      if (error && typeof error === 'object' && 'code' in error) {
        const code = error.code as string;
        if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
          setError('Invalid email or password');
        } else if (code === 'auth/too-many-requests') {
          setError('Too many failed attempts. Please try again later.');
        } else {
          setError('Login failed. Please try again.');
        }
      } else {
        setError('An error occurred. Please try again.');
      }
      setLoading(false);
    }
  };

  return (
    <>
      <Toast
        message={toastMessage || ''}
        type={toastType}
        isVisible={showToast}
        onClose={() => setShowToast(false)}
        duration={8000}
      />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#223256]/5 to-[#4FACFE]/5 py-12 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-md w-full"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              Investor Dataroom Access
            </h2>
            <p className="text-gray-600">
              Sign in to access protected investor documents
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Work Email
              </label>
              <div className="relative">
                <FiMail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="name@company.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <FiLock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <FiEyeOff className="h-5 w-5" /> : <FiEye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-start space-x-2"
              >
                <FiAlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </motion.div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <Link href={`/${locale}/forgot-password`} className="text-sm text-gray-600 hover:text-primary">
              Forgot your password?
            </Link>
          </div>

          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <Link href={`/${locale}/register`} className="text-primary hover:underline font-medium">
                Register your organization
              </Link>
            </p>
          </div>
          </div>
        </motion.div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}

