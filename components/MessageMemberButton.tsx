"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { startDirectConversation } from "@/lib/messages";
import { useDialog } from "@/lib/useDialog";

// "Message" wherever a member is listed. Sends the first line with it rather than
// opening an empty thread, for the reason start_direct_conversation takes a body:
// a conversation with nothing in it would sit in someone's inbox saying nothing.
//
// Pressing it twice is safe — the database keys a direct thread by the pair, so
// the second press continues the first thread instead of opening another.
//
// Every refusal is one sentence from the database on purpose (messages switched
// off, blocked either way, no such member all read alike), so this component
// shows what it's told and never guesses at a reason.

export function MessageMemberButton({
  slug,
  displayName,
  className,
}: {
  slug: string;
  displayName: string | null;
  className?: string;
}) {
  const { user, openAuthModal } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const close = () => {
    setIsOpen(false);
    setError(null);
  };
  const panelRef = useDialog<HTMLDivElement>(isOpen, close);

  const who = displayName || "this collector";

  const send = async () => {
    const body = draft.trim();
    if (!body || isSending) return;
    setIsSending(true);
    setError(null);
    try {
      const conversationId = await startDirectConversation(slug, body);
      setSentTo(conversationId);
      setDraft("");
      setIsOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't send.");
    } finally {
      setIsSending(false);
    }
  };

  // Once it's sent, the button's job is done — point at the thread instead of
  // inviting a second copy of the same message.
  if (sentTo) {
    return (
      <Link
        href="/inbox"
        className={`rounded border border-accent px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg ${className ?? ""}`}
      >
        In your inbox
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Signing in is the prerequisite, not an error to report after typing.
          if (!user) {
            openAuthModal("sign-in");
            return;
          }
          setIsOpen(true);
        }}
        className={`rounded border border-black/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover ${className ?? ""}`}
      >
        Message
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
          onClick={close}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="message-member-title"
            className="w-full max-w-md rounded-lg border border-black/10 bg-white p-5 text-zinc-900 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="message-member-title" className="text-base font-black uppercase tracking-wide">
              Message {who}
            </h2>
            <p className="mt-1 text-xs leading-5 text-zinc-600">
              They&apos;ll see this in their inbox here on the site, and can reply in the same
              thread.
            </p>

            <form
              className="mt-4"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <label className="sr-only" htmlFor="member-message-draft">
                Your message
              </label>
              <textarea
                id="member-message-draft"
                autoFocus
                rows={4}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Say hello to ${who}…`}
                className="w-full resize-y rounded border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-accent"
              />

              {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}

              <div className="mt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={close}
                  disabled={isSending}
                  className="rounded border border-black/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSending || draft.trim().length === 0}
                  className="rounded border border-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg disabled:opacity-60"
                >
                  {isSending ? "Sending…" : "Send"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
