"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

export type AuthModalMode = "sign-in" | "sign-up";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalMode: AuthModalMode;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithGithub: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// display_name is set at sign-up (or defaults from OAuth profile info) and
// stored in Supabase Auth's user_metadata rather than a separate table, since
// it's the only per-user profile field the app needs.
export function getDisplayName(user: User | null): string {
  if (!user) return "";
  const metadata = user.user_metadata ?? {};
  return metadata.display_name || metadata.full_name || metadata.name || "Member";
}

// A username is mandatory for every account, but OAuth sign-ups (Google/
// GitHub) never get a chance to enter one before landing back signed in —
// RequireDisplayNameGate uses this to catch that case and block the app
// until they pick one, rather than silently keeping the provider's name.
export function hasDisplayName(user: User | null): boolean {
  return Boolean(user?.user_metadata?.display_name);
}

// Regular site session only — collection tracking, submitting photos. Admin
// status is never derived here; see lib/adminAuth.tsx for the separate
// admin-mode session (signed in at /admin), which is what any "is this
// person an admin" check should use instead.
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>("sign-in");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const openAuthModal = useCallback((mode: AuthModalMode = "sign-in") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;

    return {
      user,
      session,
      isLoading,
      isAuthModalOpen,
      authModalMode,
      openAuthModal,
      closeAuthModal,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signUp: async (email, password, displayName) => {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName } },
        });
        return { error: error?.message ?? null };
      },
      signInWithGoogle: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: window.location.origin },
        });
        return { error: error?.message ?? null };
      },
      signInWithGithub: async () => {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "github",
          options: { redirectTo: window.location.origin },
        });
        return { error: error?.message ?? null };
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
      updateDisplayName: async (displayName) => {
        const { error } = await supabase.auth.updateUser({ data: { display_name: displayName } });
        return { error: error?.message ?? null };
      },
    };
  }, [session, isLoading, isAuthModalOpen, authModalMode, openAuthModal, closeAuthModal]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
