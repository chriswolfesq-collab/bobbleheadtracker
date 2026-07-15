"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AdminAuthContextValue = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

// Entirely separate from AuthProvider (lib/auth.tsx): tracks the admin-mode
// session (signed in via /admin, backed by supabaseAdmin's own session
// storage) rather than the regular site session. isAdmin here reflects
// membership in public.admins for whoever is signed into *this* session.
export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  // Keyed by user id so isAdmin/isAdminLoading can be derived during render
  // instead of needing their own state + reset-on-logout effect.
  const [adminCheck, setAdminCheck] = useState<{ forUserId: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    supabaseAdmin.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsSessionLoading(false);
    });

    const { data: subscription } = supabaseAdmin.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsSessionLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (isSessionLoading || !userId) return;

    let cancelled = false;

    supabaseAdmin.rpc("is_admin").then(({ data, error }) => {
      if (cancelled) return;

      if (error) {
        console.error("Failed to check admin status:", error.message);
      }

      setAdminCheck({ forUserId: userId, isAdmin: !error && Boolean(data) });
    });

    return () => {
      cancelled = true;
    };
  }, [isSessionLoading, userId]);

  const isAdmin = userId !== null && adminCheck?.forUserId === userId ? adminCheck.isAdmin : false;
  const isAdminLoading = userId !== null && adminCheck?.forUserId !== userId;

  const value = useMemo<AdminAuthContextValue>(() => {
    const user = session?.user ?? null;

    return {
      user,
      session,
      isAdmin,
      isLoading: isSessionLoading || isAdminLoading,
      signIn: async (email, password) => {
        const { error } = await supabaseAdmin.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signUp: async (email, password) => {
        const { error } = await supabaseAdmin.auth.signUp({ email, password });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabaseAdmin.auth.signOut();
      },
    };
  }, [session, isAdmin, isSessionLoading, isAdminLoading]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
  }

  return context;
}
