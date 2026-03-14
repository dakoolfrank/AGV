"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { 
  LogIn, 
  Mail, 
  ShieldCheck
} from "lucide-react";

// Types
type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

interface DashboardAccessWrapperProps {
  children: React.ReactNode;
}

export function DashboardAccessWrapper({ children }: DashboardAccessWrapperProps) {
  const router = useRouter();

  // Auth state
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
    isSuperAdmin: false,
  });

  // Email-link auth UI state
  const [emailForLink, setEmailForLink] = useState("");
  const [sendingLink, setSendingLink] = useState(false);
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null);

  // Access state
  const [accessGranted, setAccessGranted] = useState(false);
  const [authCheckComplete, setAuthCheckComplete] = useState(false);

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
            toast.success('Successfully signed in with email link');
            
            // Clear the email from localStorage
            window.localStorage.removeItem('agv_email_for_signin');
            
            // Clean up the URL
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } catch (error: unknown) {
          console.error('Email link sign-in error:', error);
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          toast.error('Email link sign-in failed', { description: errorMessage });
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
      setAuthCheckComplete(false);
      if (!auth.currentUser) {
        setWho({ authed: false, email: null, isAdmin: false, isSuperAdmin: false });
        setAuthCheckComplete(true);
        return;
      }
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
          }
        }
      } catch {
        setWho((s) => ({ ...s, isAdmin: false, isSuperAdmin: false }));
      } finally {
        setAuthCheckComplete(true);
      }
    })();
  }, [user?.uid]);

  // Auth actions
  const signInGoogle = async () => {
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      toast.success("Signed in with Google");
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      toast.error("Google sign-in failed", { description: errorMessage });
    }
  };

  const sendMagicLink = async () => {
    const email = emailForLink.trim();
    if (!email) return toast.error("Enter your email");
    try {
      setSendingLink(true);
      const actionCodeSettings = {
        url: `${window.location.origin}/admin`,
        handleCodeInApp: true,
      };
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      window.localStorage.setItem("agv_email_for_signin", email);
      setLinkSentTo(email);
      toast.success("Magic link sent", { description: `Check ${email}` });
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      toast.error("Failed to send magic link", { description: errorMessage });
    } finally {
      setSendingLink(false);
    }
  };

  const doSignOut = async () => {
    await signOut(auth);
    setAccessGranted(false);
    router.push('/');
  };


  // Loading state
  if (authLoading || !isClient || (user && !authCheckComplete)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  // Sign-in screen
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <ShieldCheck className="h-12 w-12 text-primary" />
            </div>
            <CardTitle>Sign in to Admin Dashboard</CardTitle>
            <CardDescription>
              Access the AGV NEXRUR admin panel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={signInGoogle} className="w-full">
              <LogIn className="mr-2 h-4 w-4" />
              Continue with Google
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sign in with Email</label>
              <input
                type="email"
                placeholder="email@domain.com"
                value={emailForLink}
                onChange={(e) => setEmailForLink(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-md"
              />
              <Button 
                onClick={sendMagicLink} 
                disabled={sendingLink}
                variant="outline"
                className="w-full"
              >
                <Mail className="mr-2 h-4 w-4" />
                {sendingLink ? "Sending..." : "Send magic link"}
              </Button>
            </div>

            {linkSentTo && (
              <div className="p-3 rounded-lg bg-green-50 border border-green-200">
                <p className="text-sm text-green-800">
                  Magic link sent to <strong>{linkSentTo}</strong>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Access gate - show unauthorized message if user is authenticated but not authorized
  // Only show this after auth check is complete
  if (authCheckComplete && !accessGranted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              {who.authed 
                ? "Your email is not authorized to access the admin dashboard"
                : "Authentication required to access admin dashboard"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {who.authed && (
              <div className="p-3 rounded-lg bg-yellow-50 border border-yellow-200">
                <p className="text-sm text-yellow-800">
                  Signed in as: <strong>{who.email}</strong>
                </p>
                <p className="text-sm text-yellow-700 mt-1">
                  Contact an administrator to request access.
                </p>
              </div>
            )}

            <Button 
              onClick={doSignOut} 
              variant="outline"
              className="w-full"
            >
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render the dashboard content
  return <>{children}</>;
}
