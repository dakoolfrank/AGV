"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { EmptyState } from "@/components/ui/empty-state";
import { Activity } from "lucide-react";

type WhoAmI = {
  authed: boolean;
  email: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
};

export default function ActivityPage() {
  const [who, setWho] = useState<WhoAmI>({
    authed: false,
    email: null,
    isAdmin: false,
    isSuperAdmin: false,
  });

  // Fetch server-verified role
  useEffect(() => {
    (async () => {
      if (!auth.currentUser) {
        setWho({ authed: false, email: null, isAdmin: false, isSuperAdmin: false });
        return;
      }
      try {
        const idToken = await auth.currentUser.getIdToken(true);
        const res = await fetch("/api/admin/whoami", {
          headers: { Authorization: `Bearer ${idToken}` },
          cache: "no-store",
        });
        const data = await res.json().catch(() => null);
        if (data) setWho(data);
      } catch {
        setWho((s) => ({ ...s, isAdmin: false, isSuperAdmin: false }));
      }
    })();
  }, []);

  const doSignOut = async () => {
    await auth.signOut();
  };

  return (
    <DashboardLayout 
      user={{
        email: auth.currentUser?.email,
        name: auth.currentUser?.displayName,
        avatar: auth.currentUser?.photoURL
      }}
      onSignOut={doSignOut}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Activity</h1>
          <p className="text-muted-foreground">
            Recent activity and system events
          </p>
        </div>
        
        <EmptyState
          icon={Activity}
          title="Activity Feed"
          description="Recent activity and system events will be displayed here"
        />
      </div>
    </DashboardLayout>
  );
}
