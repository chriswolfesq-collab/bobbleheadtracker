"use client";

import { useState } from "react";
import { sendAdminEmail } from "@/lib/adminEmail";
import { useDialog } from "@/lib/useDialog";

export type EmailRecipient = {
  id: string;
  email: string | null;
  name: string | null;
};

export type EmailTarget =
  | { kind: "all"; count: number }
  | { kind: "selected"; recipients: EmailRecipient[] };

function recipientLabel(target: EmailTarget) {
  if (target.kind === "all") {
    return `all ${target.count} ${target.count === 1 ? "user" : "users"}`;
  }
  const { recipients } = target;
  if (recipients.length === 1) {
    const only = recipients[0];
    return only.name ? `${only.name} (${only.email ?? "no email"})` : (only.email ?? "1 user");
  }
  return `${recipients.length} selected users`;
}

export function AdminEmailComposer({
  target,
  onClose,
  onSent,
}: {
  target: EmailTarget;
  onClose: () => void;
  onSent: (count: number) => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const panelRef = useDialog<HTMLDivElement>(true, onClose);

  const send = async () => {
    if (!subject.trim() || !message.trim()) {
      setError("A subject and a message are both required.");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const args =
        target.kind === "all"
          ? { subject: subject.trim(), body: message.trim(), all: true as const }
          : {
              subject: subject.trim(),
              body: message.trim(),
              recipientIds: target.recipients.map((r) => r.id),
            };

      const { sent } = await sendAdminEmail(args);
      onSent(sent);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send the email.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-email-title"
        className="w-full max-w-lg rounded-lg border border-black/10 bg-white p-6 text-zinc-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="admin-email-title" className="text-lg font-black uppercase tracking-wide">Send email</h2>
            <p className="mt-1 text-sm text-zinc-600">
              To <span className="font-semibold text-accent">{recipientLabel(target)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-black/15 px-2 py-1 text-xs font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
          >
            Close
          </button>
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            send();
          }}
        >
          <label className="block text-sm">
            <span className="font-black uppercase tracking-wide text-zinc-700">Subject</span>
            <input
              autoFocus
              type="text"
              required
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="mt-1 w-full rounded border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-accent"
            />
          </label>

          <label className="block text-sm">
            <span className="font-black uppercase tracking-wide text-zinc-700">Message</span>
            <textarea
              required
              rows={8}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="mt-1 w-full resize-y rounded border border-black/10 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-accent"
            />
          </label>

          {error ? <p className="text-sm font-semibold text-red-400">{error}</p> : null}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="rounded border border-black/15 px-4 py-2 text-xs font-black uppercase tracking-wide text-zinc-800 transition hover:border-accent hover:text-accent-hover disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSending}
              className="rounded border border-accent px-4 py-2 text-xs font-black uppercase tracking-wide text-accent transition hover:bg-accent-hover hover:text-accent-fg disabled:opacity-60"
            >
              {isSending ? "Sending…" : "Send email"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
