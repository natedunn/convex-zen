"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useZenSession } from "convex-zen/react";
import { OrganizationPlayground } from "./organization-playground";

export default function OrganizationsPage() {
  const router = useRouter();
  const { status, session } = useZenSession();

  useEffect(() => {
    if (status !== "loading" && !session) {
      router.replace("/signin");
    }
  }, [router, session, status]);

  if (status === "loading") {
    return (
      <div className="card">
        <h2>Organizations</h2>
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <>
      <h2 className="page-title">Organizations</h2>
      <p className="muted">
        Exercise the organization plugin through the generated Next auth routes.
      </p>

      <OrganizationPlayground />

      <div className="flow-links">
        <Link href="/dashboard">Back to dashboard</Link>
        <Link href="/">Back to diagnostics</Link>
      </div>
    </>
  );
}
