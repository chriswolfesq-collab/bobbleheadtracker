"use client";

import {
  AwardsSection,
  CollectionSection,
  FavoritesSection,
  SubmissionsSection,
  WantedSection,
} from "@/components/ProfileSections";
import { FriendsSection } from "@/components/FriendsSection";
import { ReferAFriend } from "@/components/ReferAFriend";
import { useProfileData } from "./ProfileShell";

// One component per tab page, all thin: each pulls what its section needs from
// the shell's context and hands it over as props, so the sections themselves
// stay prop-driven and shareable with the admin read-only view.

export function CollectionTab() {
  const { countByTeamSlug, totalByTeamSlug, displayName, sharing, isCollectionLoading } =
    useProfileData();
  return (
    <CollectionSection
      countByTeamSlug={countByTeamSlug}
      totalByTeamSlug={totalByTeamSlug}
      displayName={displayName}
      sharing={sharing}
      isCollectionLoading={isCollectionLoading}
    />
  );
}

export function AwardsTab() {
  const { countByTeamSlug, totalByTeamSlug, awardFacts, isCollectionLoading } = useProfileData();
  return (
    <AwardsSection
      countByTeamSlug={countByTeamSlug}
      totalByTeamSlug={totalByTeamSlug}
      awardFacts={awardFacts}
      isLoading={isCollectionLoading}
    />
  );
}

export function FavoritesTab() {
  const { favorites, isFavoritesLoading, favoritesError } = useProfileData();
  return <FavoritesSection favorites={favorites} isLoading={isFavoritesLoading} error={favoritesError} />;
}

export function WantedTab() {
  const { wanted, isWantedLoading, wantedError } = useProfileData();
  return <WantedSection wanted={wanted} isLoading={isWantedLoading} error={wantedError} />;
}

export function SubmissionsTab() {
  const { submissions, isSubmissionsLoading, submissionsError } = useProfileData();
  return (
    <SubmissionsSection
      submissions={submissions}
      isLoading={isSubmissionsLoading}
      error={submissionsError}
    />
  );
}

export function FriendsTab() {
  const { friendships } = useProfileData();
  return <FriendsSection friendships={friendships} />;
}

export function ReferTab() {
  // Owner-only by construction: ReferAFriend reads the signed-in session for
  // its own code, and only the owner's profile has a Refer tab — the admin
  // read-only view composes sections without it.
  return <ReferAFriend variant="section" />;
}
