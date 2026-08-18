"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/lib/auth";
import { type InboundMessageKind, sendInboundMessage } from "@/lib/inboundMessages";
import { messageAdmin } from "@/lib/messages";
import { TEAMS } from "@/lib/teams";

// The form behind both /contact and "Become a team rep" — the same four fields
// either way, with a team picker added for an application. Shared so the two
// don't drift in validation, error copy or the shape of what lands in
// inbound_messages.
//
// Sign-in is deliberately not required, and the email field starts empty even
// for a signed-in visitor. It used to prefill from the session, which meant a
// shared or admin browser put a real personal address on screen — and into the
// message — without anyone choosing to send it. Typing it is cheap; the
// surprise wasn't.
//
// A signed-in visitor on /contact gets a different form entirely
// (allowSignedInThread): their message opens a thread in their inbox rather than
// an email round trip, so the reply lands somewhere they can find it and the
// name and email fields have nothing to ask. Anyone not signed in keeps the
// email path exactly as it was — the whole point of the form is that it works
// without an account, and a stranger has no inbox to read.
//
// Rep applications stay on the email path either way: /admin/reps assigns a rep
// by email address, often before they have signed up, so routing an application
// into a thread would answer it somewhere the assignment flow can't see.

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
  allowSignedInThread,
}: {
  kind: InboundMessageKind;
  defaultTeamSlug?: string;
  messageLabel: string;
  messagePlaceholder: string;
  submitLabel: string;
  /** Called after a successful send, for a dialog that wants to close itself. */
  onSent?: () => void;
  /**
   * Route a signed-in sender into their admin thread instead of the email path.
   * Set by /contact only; the rep application dialog leaves it off on purpose.
   */
  allowSignedInThread?: boolean;
}) {
  const { user } = useAuth();
  // Anonymous senders, and every rep application, keep the email path.
  const asThread = Boolean(allowSignedInThread && user && kind === "contact");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [teamSlug, setTeamSlug] = useState(defaultTeamSlug ?? "");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [didSend, setDidSend] = useState(false);

  async function submit() {
    setError(null);
    setIsSending(true);
    try {
      if (asThread) {
        await messageAdmin(message);
      } else {
        await sendInboundMessage({ kind, name, email, message, teamSlug: teamSlug || null });
      }
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
            : asThread
              ? "Thanks — the reply will land in your inbox here on the site."
              : "Thanks — we'll reply to the address you gave us."}
        </p>
        {asThread ? (
          <p className="mt-3">
            <Link href="/inbox" className="font-semibold text-accent hover:text-accent-hover">
              Go to your inbox
            </Link>
          </p>
        ) : null}
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
      {asThread ? null : (
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
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            className={INPUT_CLASS}
          />
        </label>
      </div>
      )}

      {asThread ? (
        <p className="rounded border border-accent/30 bg-accent/[0.06] px-3 py-2 text-xs leading-5 text-zinc-700">
          You&apos;re signed in, so this becomes a thread in your{" "}
          <Link href="/inbox" className="font-semibold text-accent hover:text-accent-hover">
            inbox
          </Link>{" "}
          — no email address needed, and the reply stays on the site.
        </p>
      ) : null}

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
