"use client";

import { useToast } from "@/components/Toast";
import type { EmailPreferenceKind, EmailPreferences } from "@/lib/profile";

// The email opt-outs: a master switch plus one row per kind of automated mail
// the site sends (see supabase/email_preferences.sql). Same interaction shape as
// GalleryToggle — the switch flipping is the success feedback, and the toast
// is error-only.
//
// Admin-composed one-off emails aren't listed because they aren't governed by
// these switches: a direct reply from the site owner isn't a notification, and
// the send path deliberately ignores the preferences. See the note at the top of
// supabase/functions/admin-send-email.

type Row = {
  kind: EmailPreferenceKind;
  label: string;
  on: string;
  off: string;
  /** Only rendered for admins — the rep digest is only ever sent to them. */
  adminOnly?: boolean;
  /** Only rendered for admins and team reps — nobody else can read the board
   *  the forum digest summarizes. */
  moderatorOnly?: boolean;
};

const ROWS: Row[] = [
  {
    kind: "wanted_alerts",
    label: "Wanted alerts",
    on: "We'll email you when a bobblehead on your wanted list is marked owned by another collector.",
    off: "Turn this on to get an email when a bobblehead on your wanted list gets a new owner.",
  },
  {
    kind: "submission_updates",
    label: "Submission updates",
    on: "We'll email you when a photo or bobblehead you submitted is approved or turned down.",
    off: "Turn this on to hear back when a photo or bobblehead you submitted is reviewed.",
  },
  {
    kind: "messages",
    label: "New messages",
    on: "We'll email you when someone sends you a message on the site, at most once every 15 minutes per conversation.",
    off: "Turn this on to hear by email when someone messages you on the site. Your inbox still collects them either way.",
  },
  {
    kind: "weekly_digest",
    label: "Weekly roundup",
    on: "Once a week you'll get an email listing the bobbleheads added for the teams you collect. Quiet weeks send nothing.",
    off: "Turn this on to hear once a week about new bobbleheads for the teams you collect.",
  },
  {
    kind: "rep_digest",
    label: "Daily rep summary",
    on: "You'll get one email at the end of each day listing what the team reps changed.",
    off: "Turn this on to get a daily email listing what the team reps changed.",
    adminOnly: true,
  },
  {
    kind: "forum_digest",
    label: "Team Rep Forum",
    on: "Each morning you'll get an email listing the Team Rep Forum threads you haven't read. Nothing unread, nothing sent.",
    off: "Turn this on for a morning email about Team Rep Forum threads you haven't read.",
    moderatorOnly: true,
  },
];

function Switch({
  checked,
  disabled,
  label,
  onToggle,
}: {
  checked: boolean;
  disabled: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-60 ${
        checked ? "bg-accent" : "bg-black/[0.08]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function EmailAlertsToggle({ alerts }: { alerts: EmailPreferences }) {
  const { values, isLoading, savingKind, isAdmin, isModerator, setPreference } = alerts;
  const { showError } = useToast();

  async function toggle(kind: EmailPreferenceKind, next: boolean) {
    const { error } = await setPreference(kind, next);
    if (error) showError(error);
  }

  if (isLoading) return null;

  const allOff = !values.all;
  const rows = ROWS.filter(
    (row) => (!row.adminOnly || isAdmin) && (!row.moderatorOnly || isModerator),
  );

  return (
    <div className="mb-8 rounded-2xl border border-black/10 bg-black/[0.04] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
            Email notifications
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600">
            {allOff
              ? "All email notifications are off. You'll still get essential account email, like a password reset."
              : "Choose which emails you want. Turn this off to stop all of them at once."}
          </p>
        </div>

        <Switch
          checked={values.all}
          disabled={savingKind !== null}
          label="Email me notifications"
          onToggle={() => toggle("all", !values.all)}
        />
      </div>

      {/* The per-type rows stay visible but go inert when the master is off, so
          it's clear what would come back rather than the list just vanishing. */}
      <div
        className={`mt-4 space-y-4 border-t border-black/10 pt-4 transition-opacity ${
          allOff ? "opacity-40" : ""
        }`}
      >
        {rows.map((row) => (
          <div key={row.kind} className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-zinc-500">
                {row.label}
              </h3>
              <p className="mt-1 text-sm text-zinc-600">
                {values[row.kind] ? row.on : row.off}
              </p>
            </div>
            <Switch
              checked={values[row.kind]}
              disabled={allOff || savingKind !== null}
              label={row.label}
              onToggle={() => toggle(row.kind, !values[row.kind])}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
