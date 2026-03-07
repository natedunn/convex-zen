"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { SessionCard } from "@convex-zen/playground-ui";

type Session = {
  userId: string;
  sessionId: string;
} | null;

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session>(null);
  const [email, setEmail] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const loadSession = async () => {
    setLoading(true);
    try {
      const s = await authClient.getSession();
      if (!s) {
        router.replace("/signin");
        return;
      }
      setSession(s);
      try {
        const user = await authClient.currentUser();
        setEmail(user?.email);
      } catch {
        // email is best-effort
      }
    } catch {
      router.replace("/signin");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSession();
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
    }
  };

  if (loading || !session) {
    return (
      <div className="card">
        <h2>Dashboard</h2>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  return (
    <>
      <h2 className="page-title">Dashboard</h2>

      <SessionCard
        userId={session.userId}
        sessionId={session.sessionId}
        email={email}
        onSignOut={handleSignOut}
        onRefresh={() => void loadSession()}
        signingOut={signingOut}
      />

      <p className="muted">
        Session tokens are stored in an HttpOnly cookie and never exposed to
        client code.
      </p>

      <div className="flow-links">
        <Link href="/">Back to diagnostics</Link>
      </div>
    </>
  );
}
