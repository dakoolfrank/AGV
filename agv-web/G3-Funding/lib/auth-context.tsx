'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signInWithEmailLink, sendSignInLinkToEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { KOLProfile } from '@/lib/types';

interface AuthContextType {
  user: any;
  kolProfile: KOLProfile | null;
  loading: boolean;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [kolProfile, setKolProfile] = useState<KOLProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Fetch KOL profile
        try {
          const kolDoc = await getDoc(doc(db, 'kol_profiles', user.uid));
          if (kolDoc.exists()) {
            setKolProfile({ id: kolDoc.id, ...kolDoc.data() } as KOLProfile);
          } else {
            setKolProfile(null);
          }
        } catch (error) {
          console.error('Error fetching KOL profile:', error);
          setKolProfile(null);
        }
      } else {
        setKolProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithEmail = async (email: string) => {
    const actionCodeSettings = {
      url: `${window.location.origin}/en/auth/callback`,
      handleCodeInApp: true,
    };

    try {
      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      // Store email for verification
      localStorage.setItem('emailForSignIn', email);
    } catch (error) {
      console.error('Error sending sign-in link:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    kolProfile,
    loading,
    signInWithEmail,
    signOut,
    isAuthenticated: !!user && !!kolProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
