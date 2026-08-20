"use client";

import type { GalleryPhoto } from "@/lib/bobbleheadGallery";
import { PhotoManageControls } from "@/components/PhotoManageControls";
import { PhotoVotePill } from "@/components/PhotoVotePill";

// Where a photo in the strip actually lives, which is what decides how it can
// be edited:
//   main     — the listing's profile photo (an approved_photos row, or the
//              seed/community image showing because there is no approved row).
//   underlay — a photo sitting *beneath* the main one with no row of its own: a
//              curated listing's seed image, or a community listing's own
//              image_url. It can be cleared, but there's nothing to promote.
//   gallery  — a bobblehead_gallery_photos row; the full set of controls.
export type StripPhoto = {
  url: string;
  kind: "main" | "underlay" | "gallery";
  /** Set on, and only on, `kind: "gallery"`. */
  photo?: GalleryPhoto;
  // Defaults to removable. Cleared for a community listing's original
  // image_url with an approved photo over it: removing the profile photo
  // clears both in the same write, so a Remove here would quietly take the
  // photo above it too. It can still be made the main photo — that only takes
  // the layer above it away.
  removable?: boolean;
};

export type StripVotes = {
  votesByUrl: Record<string, number>;
  myVoteUrl: string | null;
  isLoggedIn: boolean;
  toggleVote: (url: string) => void;
};

// The row of thumbnails under the big photo. Every photo on the listing is in
// here — profile photo, the seed underneath it, and each gallery photo — so
// with management on this is the one place a rep has to go to fix a wrong
// picture. Before, the profile photo could only be reached through the edit
// dialog at the bottom of the page while the rest were managed from the
// Community Photos card, and two reps reported the same round trip: remove the
// photo in the dialog, reopen it, upload the new one.
export function ListingPhotoStrip({
  photos,
  selectedUrl,
  onSelect,
  votes,
  isManaging = false,
  currentMainUrl = null,
  onSetAsMain,
  onReplace,
  onRemove,
}: {
  photos: StripPhoto[];
  /** The photo showing in the big frame, which gets the accent border. */
  selectedUrl: string | null;
  onSelect: (url: string) => void;
  votes: StripVotes;
  isManaging?: boolean;
  currentMainUrl?: string | null;
  onSetAsMain?: (photo: StripPhoto) => void;
  onReplace?: (photo: StripPhoto, file: File) => void;
  onRemove?: (photo: StripPhoto) => void;
}) {
  if (photos.length === 0) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {photos.map((photo) => (
        <div key={photo.url} className="flex shrink-0 flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => onSelect(photo.url)}
            aria-label="Show this photo"
            aria-pressed={photo.url === selectedUrl}
            className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition ${
              photo.url === selectedUrl ? "border-accent" : "border-border-soft hover:border-accent/50"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt="" className="h-full w-full object-contain" />
          </button>
          <PhotoVotePill
            votes={votes.votesByUrl[photo.url] ?? 0}
            isMine={votes.myVoteUrl === photo.url}
            isLoggedIn={votes.isLoggedIn}
            onToggle={() => votes.toggleVote(photo.url)}
          />
          {isManaging ? (
            <PhotoManageControls
              // Every photo can be made the main one; the control shows a label
              // instead of a button for the photo that already is.
              isCurrentMain={photo.url === currentMainUrl}
              onSetAsMain={onSetAsMain ? () => onSetAsMain(photo) : undefined}
              // An underlay isn't swapped in place — uploading over it would
              // just write the main photo, which is the "Swap" one row over.
              onReplace={
                onReplace && photo.kind !== "underlay" ? (file) => onReplace(photo, file) : undefined
              }
              onDelete={onRemove && photo.removable !== false ? () => onRemove(photo) : undefined}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
