"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
  GoogleAuthProvider,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { AuthCard } from "@/components/admin/AuthCard";
import { LoadingSpinner } from "@/components/admin/LoadingSpinner";
import { DashboardLayout } from "@/components/admin/DashboardLayout";

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

export function DashboardAccessWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const params = useParams();
  const locale = params.locale as string;
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [, setWho] = useState<WhoAmI>({ authed: false, email: null, isAdmin: false, isSuperAdmin: false });
  const [accessGranted, setAccessGranted] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Email-link auth UI state
  const [emailForLink] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);

  useEffect(() => setIsClient(true), []);

  // Handle email link authentication
  useEffect(() => {
    const handleEmailLink = async () => {
      if (!isClient) return;
      
      if (isSignInWithEmailLink(auth, window.location.href)) {
        try {
          // Get the email if available
          let email = window.localStorage.getItem('agv_email_for_signin');
          
          if (!email) {
            // If no email in localStorage, prompt user
            email = window.prompt('Please provide your email for confirmation');
          }
          
          if (email) {
            // Sign in with the email link
            const result = await signInWithEmailLink(auth, email, window.location.href);
            console.log('Email link sign-in successful:', result.user.email);
            
            // Clear the email from localStorage
            window.localStorage.removeItem('agv_email_for_signin');
            
            // Clean up the URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (error: unknown) {
          console.error('Email link sign-in error:', error);
        }
      }
    };

    if (isClient) {
      handleEmailLink();
    }
  }, [isClient]);

  // Auth state management
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch server-verified role
  useEffect(() => {
    (async () => {
      if (!auth.currentUser) {
        setWho({ authed: false, email: null, isAdmin: false, isSuperAdmin: false });
        setAccessGranted(false);
        setCheckingAccess(false);
        return;
      }
      setCheckingAccess(true);
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        const res = await fetch("/api/admin/whoami", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (data) {
          setWho(data);
          // If user is authorized admin, grant access
          if (data.isAdmin || data.isSuperAdmin) {
            setAccessGranted(true);
          } else {
            setAccessGranted(false);
          }
        } else {
          setAccessGranted(false);
        }
      } catch {
        setWho((s) => ({ ...s, isAdmin: false, isSuperAdmin: false }));
        setAccessGranted(false);
      } finally {
        setCheckingAccess(false);
      }
    })();
  }, [user?.uid]);

  // Auth actions
  const signInGoogle = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (e: unknown) {
      console.error("Google sign-in failed", e);
    }
  };

  const sendMagicLink = async () => {
    const email = emailForLink.trim();
    if (!email) return;
    try {
      setSendingLink(true);
      const actionCodeSettings = {
        url: `${window.location.origin}/admin`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("agv_email_for_signin", email);
      setLinkSentTo(email);
    } catch (e: unknown) {
      console.error("Failed to send magic link", e);
    } finally {
      setSendingLink(false);
    }
  };

  const doSignOut = async () => {
    await signOut(auth);
    setAccessGranted(false);
    router.push('/');
  };

  if (authLoading || !isClient || checkingAccess) return <LoadingSpinner />;
  if (!user) return (
    <AuthCard 
      onSignIn={signInGoogle} 
      onSendMagicLink={sendMagicLink}
      sendingLink={sendingLink}
      linkSentTo={linkSentTo}
    />
  );
  if (!accessGranted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">Your email is not authorized to access the admin dashboard.</p>
          <button onClick={doSignOut} className="w-full bg-gray-100 text-gray-900 py-2 px-4 rounded-md hover:bg-gray-200">
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout user={user} onSignOut={doSignOut} locale={locale}>
      {children}
    </DashboardLayout>
  );
}

