"use client";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CollectionTransfer } from "@/components/CollectionTransfer";
import { EmailAlertsToggle } from "@/components/EmailAlertsToggle";
import { FriendVisibilityToggle } from "@/components/FriendVisibilityToggle";
import { GalleryToggle } from "@/components/GalleryToggle";
import { MessagePrivacyToggle } from "@/components/MessagePrivacyToggle";
import { SearchListingToggle } from "@/components/SearchListingToggle";
import { ShelfLinkCard } from "@/components/ShelfLinkCard";
import { useAuth } from "@/lib/auth";
import {
  useEmailPreferences,
  useMessagePrivacy,
  useFriendVisibility,
  useGallerySharing,
  useMyShelf,
  useSearchListing,
} from "@/lib/profile";

export function SettingsPageClient() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const sharing = useMyShelf();
  const gallery = useGallerySharing();
  const friendVisibility = useFriendVisibility();
  const searchListing = useSearchListing();
  const alerts = useEmailPreferences();
  const messagePrivacy = useMessagePrivacy();

  return (
    <div
      className="flex min-h-full flex-1 flex-col"
      style={{ background: "var(--page-gradient)" }}
    >
      {/* Outside the signed-in branch: the trail is also the way back out of
          the sign-in prompt. */}
      <div className="mx-auto w-full max-w-2xl px-4 pt-4 sm:px-6">
        <Breadcrumbs items={[{ href: "/", label: "Home" }, { label: "Settings" }]} />
      </div>

      {isAuthLoading ? null : !user ? (
        <div className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 pb-24 text-center">
          <h1 className="text-lg font-black text-zinc-900">Sign in to see your settings</h1>
          <p className="text-sm text-zinc-600">
            Log in to manage your public shelf and other preferences.
          </p>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-2xl px-4 pb-24 pt-2 sm:px-6">
          <header className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-accent/80 sm:text-xs">
              Settings
            </p>
          </header>

          <ShelfLinkCard sharing={sharing} />
          {/* Right under the link card: the gallery decides what that link
              shows, so the two read as one setting. */}
          <GalleryToggle gallery={gallery} />
          {/* Directly under the public switch: the two answer the same question
              for different audiences, and reading them together is the only way
              to see what each one covers. */}
          <FriendVisibilityToggle visibility={friendVisibility} />
          {/* After the two "what can they see" switches, because this one is a
              different question — who can find you at all, rather than what a
              given audience gets. */}
          <SearchListingToggle listing={searchListing} />
          <MessagePrivacyToggle privacy={messagePrivacy} />
          <EmailAlertsToggle alerts={alerts} />
          <CollectionTransfer />
        </div>
      )}
    </div>
  );
}
