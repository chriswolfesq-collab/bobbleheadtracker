"use client";

import type { Session, User } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AdminAuthContextValue = {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  // A rep has team-scoped edit rights but is not a full admin. isAdmin and
  // isRep are independent: a full admin has isAdmin true and isRep false.
  isRep: boolean;
  // Team slugs this account may edit as a rep (empty for a pure admin, who can
  // edit any team — canEditTeam folds that in).
  editableTeams: string[];
  // The single question every edit affordance should ask: may this account edit
  // this team? True for a full admin (any team) or that team's rep.
  canEditTeam: (teamSlug: string) => boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

// Tracks the same single main-site session as AuthProvider (supabaseAdmin is
// now an alias of the main client — see lib/supabaseAdmin.ts) and layers the
// admin/rep capability checks on top of it: isAdmin reflects membership in
// public.admins, and editableTeams comes from my_editable_teams(), both keyed
// on the signed-in account's email. So whoever is logged into the site — by
// password or Google/GitHub — gets their powers here with no separate login.
// This provider stays distinct from AuthProvider only to keep that capability
// logic (and the many useAdminAuth consumers) in one place.
export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  // Keyed by user id so isAdmin/isAdminLoading can be derived during render
  // instead of needing their own state + reset-on-logout effect.
  const [adminCheck, setAdminCheck] = useState<{
    forUserId: string;
    isAdmin: boolean;
    editableTeams: string[];
  } | null>(null);

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

    // One round-trip for both grants: full-admin status and this account's rep
    // teams. Resolved together so isAdmin and editableTeams never disagree
    // about who is signed in.
    Promise.all([
      supabaseAdmin.rpc("is_admin"),
      supabaseAdmin.rpc("my_editable_teams"),
    ]).then(([adminResult, teamsResult]) => {
      if (cancelled) return;

      if (adminResult.error) {
        console.error("Failed to check admin status:", adminResult.error.message);
      }
      if (teamsResult.error) {
        console.error("Failed to load editable teams:", teamsResult.error.message);
      }

      const editableTeams: string[] = !teamsResult.error && Array.isArray(teamsResult.data)
        ? (teamsResult.data as unknown[]).map(String)
        : [];

      setAdminCheck({
        forUserId: userId,
        isAdmin: !adminResult.error && Boolean(adminResult.data),
        editableTeams,
      });
    });

    return () => {
      cancelled = true;
    };
  }, [isSessionLoading, userId]);

  const checkReady = userId !== null && adminCheck?.forUserId === userId;
  const isAdmin = checkReady ? adminCheck!.isAdmin : false;
  // Memoized so the `: []` fallback doesn't hand a fresh array to the value
  // useMemo on every render (which would defeat it). When ready, this is the
  // stable array held in adminCheck state.
  const editableTeams = useMemo<string[]>(
    () => (checkReady ? adminCheck!.editableTeams : []),
    [checkReady, adminCheck],
  );
  const isAdminLoading = userId !== null && adminCheck?.forUserId !== userId;

  const value = useMemo<AdminAuthContextValue>(() => {
    const user = session?.user ?? null;

    return {
      user,
      session,
      isAdmin,
      isRep: !isAdmin && editableTeams.length > 0,
      editableTeams,
      canEditTeam: (teamSlug: string) => isAdmin || editableTeams.includes(teamSlug),
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
  }, [session, isAdmin, editableTeams, isSessionLoading, isAdminLoading]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);

  if (!context) {
    throw new Error("useAdminAuth must be used inside AdminAuthProvider.");
  }

  return context;
}
