"use client";

import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { MessageMemberButton } from "@/components/MessageMemberButton";
import { avatarPublicUrl } from "@/lib/avatar";
import { useTeamReps } from "@/lib/teamReps";

// The moderator line at the foot of the board, asked for by a rep who wanted a
// member with a wrong listing to know where to send it. One team's own rep,
// never a roster: this card sits on a team page and asks only about that team
// (supabase/team_rep_list.sql), and admins — who edit every team and rep none —
// are not in it.
//
// Renders nothing at all when the team has no rep to name. The alternative,
// "no rep yet", says something the Become a Team Rep pitch directly underneath
// already says better.
export function TeamRepsCard({ teamSlug, teamName }: { teamSlug: string; teamName: string }) {
  const { reps, isLoading } = useTeamReps(teamSlug);

  if (isLoading || reps.length === 0) return null;

  return (
    <div className="mt-10 rounded-2xl border border-border-soft bg-surface px-6 py-6">
      <h2 className="font-display text-lg font-bold uppercase tracking-wide text-navy">
        {reps.length === 1 ? "Team Rep" : "Team Reps"}
      </h2>
      <p className="mt-1.5 text-sm leading-6 text-zinc-600">
        {reps.length === 1 ? "Keeps" : "Keep"} the {teamName} page accurate. Spotted something
        wrong on a listing? Send it their way.
      </p>
      <ul className="mt-4 flex flex-wrap gap-3">
        {reps.map((rep) => (
          <li
            key={rep.slug}
            className="flex min-w-0 items-center gap-3 rounded-lg border border-black/10 bg-white p-3"
          >
            <Avatar
              name={rep.displayName}
              url={avatarPublicUrl(rep.avatarPath)}
              className="h-9 w-9 text-sm"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-zinc-900">{rep.displayName}</p>
              <Link
                href={`/shelf/${rep.slug}`}
                className="text-xs font-semibold text-accent underline-offset-2 hover:underline"
              >
                View shelf
              </Link>
            </div>
            {/* Same pairing as the member search row: a name you can reach, not
                just a name. Messaging doesn't wait on a friendship. */}
            <MessageMemberButton slug={rep.slug} displayName={rep.displayName} />
          </li>
        ))}
      </ul>
    </div>
  );
}
