"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { type InboundMessageKind, sendInboundMessage } from "@/lib/inboundMessages";
import { TEAMS } from "@/lib/teams";

// The form behind both /contact and "Become a team rep" — the same four fields
// either way, with a team picker added for an application. Shared so the two
// don't drift in validation, error copy or the shape of what lands in
// inbound_messages.
//
// Sign-in is deliberately not required. The email field is prefilled for a
// signed-in visitor as a convenience, and stays editable.

const INPUT_CLASS =
  "mt-1 w-full rounded border border-border-soft bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-accent";
const LABEL_CLASS = "text-xs font-black uppercase tracking-wide text-zinc-500";

export function InboundMessageForm({
  kind,
  /**
   * Preselects the team picker when the visitor arrived from a specific team's
   * page. Still changeable — they may have followed the link and then thought
   * better of which team they actually want.
   */
  defaultTeamSlug,
  messageLabel,
  messagePlaceholder,
  submitLabel,
  onSent,
}: {
  kind: InboundMessageKind;
  defaultTeamSlug?: string;
  messageLabel: string;
  messagePlaceholder: string;
  submitLabel: string;
  /** Called after a successful send, for a dialog that wants to close itself. */
  onSent?: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  // Derived rather than synced from the session in an effect: null means
  // "untouched", so the field shows the signed-in address as soon as it resolves
  // and stops tracking it the moment the visitor types. Copying it into state
  // from an effect would mean a setState during render-commit, which cascades.
  const [typedEmail, setTypedEmail] = useState<string | null>(null);
  const email = typedEmail ?? user?.email ?? "";
  const [teamSlug, setTeamSlug] = useState(defaultTeamSlug ?? "");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didSend, setDidSend] = useState(false);

  async function submit() {
    setError(null);
    setIsSending(true);
    try {
      await sendInboundMessage({ kind, name, email, message, teamSlug: teamSlug || null });
      setDidSend(true);
      onSent?.();
    } catch (sendError) {
      setError(
        sendError instanceof Error ? sendError.message : "Couldn't send that. Please try again.",
      );
    } finally {
      setIsSending(false);
    }
  }

  if (didSend) {
    return (
      <div className="rounded-xl border border-accent/30 bg-accent/[0.06] p-5 text-sm leading-6 text-zinc-700">
        <p className="font-display text-base font-bold uppercase tracking-wide text-navy">
          {kind === "rep_application" ? "Application sent" : "Message sent"}
        </p>
        <p className="mt-2">
          {kind === "rep_application"
            ? "Thanks — we'll be in touch at the address you gave us."
            : "Thanks — we'll reply to the address you gave us."}
        </p>
      </div>
    );
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={LABEL_CLASS}>Your name</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="name"
            className={INPUT_CLASS}
          />
        </label>
        <label className="block">
          <span className={LABEL_CLASS}>Your email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setTypedEmail(event.target.value)}
            autoComplete="email"
            className={INPUT_CLASS}
          />
        </label>
      </div>

      {kind === "rep_application" ? (
        <label className="block">
          <span className={LABEL_CLASS}>Team you&apos;d like to represent</span>
          <select
            required
            value={teamSlug}
            onChange={(event) => setTeamSlug(event.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Pick a team…</option>
            {TEAMS.map((team) => (
              <option key={team.slug} value={team.slug}>
                {team.city} {team.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <label className="block">
        <span className={LABEL_CLASS}>{messageLabel}</span>
        <textarea
          required
          rows={6}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={messagePlaceholder}
          className={`${INPUT_CLASS} resize-y`}
        />
      </label>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      <Button type="submit" disabled={isSending} className="w-full sm:w-auto">
        {isSending ? "Sending…" : submitLabel}
      </Button>
    </form>
  );
}
