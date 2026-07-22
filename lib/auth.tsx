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
  // An OAuth sign-in that failed and bounced us back with an error in the URL.
  // Surfaced so the modal can show it — see the mount effect below.
  oauthError: string | null;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  clearOauthError: () => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  signInWithGithub: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<{ error: string | null }>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Long enough for a real name ("Bartholomew Fitzwilliam" is 23), short enough
// to stay on one line everywhere it's shown. The public shelf card clamps at 26
// characters of its own accord — that clamp stays as a backstop, since it also
// has to cope with names that predate this limit.
export const MAX_DISPLAY_NAME_LENGTH = 32;

/** The single definition of a valid display name. Returns null when it's fine. */
export function validateDisplayName(displayName: string): string | null {
  const trimmed = displayName.trim();

  if (!trimmed) return "Please enter a name.";
  if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
    return `Names are limited to ${MAX_DISPLAY_NAME_LENGTH} characters.`;
  }
  return null;
}

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
  const [oauthError, setOauthError] = useState<string | null>(null);

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

  // Supabase's implicit OAuth flow reports failures (e.g. an email that already
  // belongs to another account) by redirecting back here with error params in
  // the URL. auth-js parses them, throws internally, and never surfaces them
  // through getSession/onAuthStateChange — so without this the user just lands
  // back on the page silently signed out. Pull the message out ourselves, show
  // it in the modal, then scrub the params so a refresh doesn't resurface it.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const errorKeys = ["error", "error_code", "error_description"];
    const extract = (raw: string): string | null => {
      const params = new URLSearchParams(raw.replace(/^[#?]/, ""));
      if (!errorKeys.some((key) => params.has(key))) return null;
      return (
        params.get("error_description") ||
        params.get("error") ||
        "Sign-in failed. Please try again."
      );
    };

    const message = extract(window.location.hash) ?? extract(window.location.search);
    if (!message) return;

    // Reading window.location is only possible after mount (no window during
    // SSR), so this state must be set here rather than in an initializer, which
    // would desync server/client hydration. Runs once, and only when a failed
    // OAuth redirect is actually present — no cascading-render concern.
    /* eslint-disable react-hooks/set-state-in-effect */
    setOauthError(message);
    setAuthModalMode("sign-in");
    setIsAuthModalOpen(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Remove only the auth error params, leaving any unrelated hash/query intact.
    const url = new URL(window.location.href);
    errorKeys.forEach((key) => url.searchParams.delete(key));
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));
    errorKeys.forEach((key) => hashParams.delete(key));
    url.hash = hashParams.toString();
    window.history.replaceState(window.history.state, "", url.toString());
  }, []);

  const openAuthModal = useCallback((mode: AuthModalMode = "sign-in") => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  const closeAuthModal = useCallback(() => {
    setIsAuthModalOpen(false);
    setOauthError(null);
  }, []);

  const clearOauthError = useCallback(() => {
    setOauthError(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;

    return {
      user,
      session,
      isLoading,
      isAuthModalOpen,
      authModalMode,
      oauthError,
      openAuthModal,
      closeAuthModal,
      clearOauthError,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
      },
      signUp: async (email, password, displayName) => {
        // Enforced here rather than only at the input, so every caller is bound
        // by it — Supabase Auth applies no constraints of its own to
        // user_metadata.
        const invalid = validateDisplayName(displayName);
        if (invalid) return { error: invalid };

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { display_name: displayName.trim() } },
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
        const invalid = validateDisplayName(displayName);
        if (invalid) return { error: invalid };

        const { error } = await supabase.auth.updateUser({
          data: { display_name: displayName.trim() },
        });
        return { error: error?.message ?? null };
      },
    };
  }, [session, isLoading, isAuthModalOpen, authModalMode, oauthError, openAuthModal, closeAuthModal, clearOauthError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
