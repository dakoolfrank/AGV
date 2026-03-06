'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface AuthContextType {
  user: FirebaseUser | null;
  isAuthenticated: boolean;
  hasAccess: boolean;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        // Check if user has access
        try {
          const idToken = await firebaseUser.getIdToken();
          const response = await fetch('/api/auth/check-access', {
            headers: {
              Authorization: `Bearer ${idToken}`,
            },
          });

          if (response.ok) {
            setHasAccess(true);
          } else {
            setHasAccess(false);
          }
        } catch (error) {
          console.error('Error checking access:', error);
          setHasAccess(false);
        }
      } else {
        setHasAccess(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setHasAccess(false);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      hasAccess,
      loading,
      logout,
    }}>
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
