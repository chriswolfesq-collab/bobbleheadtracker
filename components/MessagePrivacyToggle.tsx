"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { useToast } from "@/components/Toast";
import { avatarPublicUrl } from "@/lib/avatar";
import { useMessageBlocks } from "@/lib/messages";
import type { MessagePrivacy } from "@/lib/profile";

// Who may start a conversation with you, and who you've shut out — see
// supabase/messages.sql and supabase/direct_messages.sql.
//
// The switch is on by default and covers other MEMBERS only. It deliberately
// can't close the thread with the admins: "I can't reach the people who run the
// site" is not a setting anyone means to turn on, and a report about another
// member is exactly the message someone would send right after switching this
// off.
//
// The block list sits under the switch rather than in its own section because
// they answer the same question at different scales — everyone, or this person.
export function MessagePrivacyToggle({ privacy }: { privacy: MessagePrivacy }) {
  const { enabled, isLoading, isSaving, setEnabled } = privacy;
  const { blocks, isLoading: isLoadingBlocks, error, unblock } = useMessageBlocks();
  const { showError } = useToast();

  async function handleToggle() {
    const { error: saveError } = await setEnabled(!enabled);
    if (saveError) showError(saveError);
  }

  if (isLoading) return null;

  return (
    <div className="mb-8 rounded-2xl border border-black/10 bg-black/[0.04] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
            Messages from members
          </h2>
          <p className="mt-1.5 text-sm text-zinc-600">
            {enabled
              ? "Other collectors can start a conversation with you, and it arrives in your inbox on the site."
              : "Other collectors can't start a conversation with you. Threads you're already in still work, and you can still start one yourself."}
          </p>
          <p className="mt-1.5 text-xs text-zinc-500">
            Either way you can always reach us — the thread with the admins in your{" "}
            <Link href="/inbox" className="font-semibold text-accent hover:underline">
              inbox
            </Link>{" "}
            stays open, and turning this off never closes it.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="Let other collectors message me"
          disabled={isSaving}
          onClick={handleToggle}
          className={`relative h-6 w-11 flex-shrink-0 rounded-full transition disabled:opacity-60 ${
            enabled ? "bg-accent" : "bg-black/[0.08]"
          }`}
        >
          <span
            aria-hidden
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              enabled ? "left-[1.375rem]" : "left-0.5"
            }`}
          />
        </button>
      </div>

      {/* Only shown when there's something in it: an empty "Blocked" heading
          invites the question of who you've blocked, which is nobody. */}
      {!isLoadingBlocks && blocks.length > 0 ? (
        <div className="mt-4 border-t border-black/10 pt-4">
          <h3 className="text-xs font-black uppercase tracking-[0.25em] text-zinc-600">
            Blocked
          </h3>
          <p className="mt-1.5 text-xs text-zinc-500">
            Neither of you can send in a conversation you already share. They&apos;re never told,
            and nothing either of you sent has been deleted.
          </p>
          {error ? <p className="mt-2 text-sm font-semibold text-red-600">{error}</p> : null}
          <ul className="mt-3 space-y-2">
            {blocks.map((block) => (
              <li
                key={block.slug}
                className="flex items-center gap-3 rounded-lg border border-black/10 bg-white p-2.5"
              >
                <Avatar
                  name={block.display_name}
                  url={avatarPublicUrl(block.avatar_path)}
                  className="h-8 w-8 text-xs"
                />
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-zinc-900">
                  {block.display_name || block.slug}
                </span>
                <button
                  type="button"
                  onClick={() => void unblock(block.slug)}
                  className="shrink-0 rounded border border-black/15 px-3 py-1.5 text-[11px] font-black uppercase tracking-wide text-zinc-700 transition hover:border-accent hover:text-accent-hover"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
