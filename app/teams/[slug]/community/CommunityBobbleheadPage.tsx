"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { EnlargeablePhoto } from "@/components/EnlargeablePhoto";
import { resolveTitleParts } from "@/components/BobbleheadTitle";
import { EditBobbleheadDialog, type EditBobbleheadValues } from "@/components/EditBobbleheadDialog";
import { extractYear } from "@/lib/extractYear";
import { FavoriteButton } from "@/components/FavoriteButton";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ReportListingButton } from "@/components/ReportListingDialog";
import { SubmitPhotoButton } from "@/components/SubmitPhotoDialog";
import { useToast } from "@/components/Toast";
import { NamePlate } from "@/components/ui/NamePlate";
import { useAdminAuth } from "@/lib/adminAuth";
import { deleteBobblehead, deleteGalleryPhoto, deleteMainPhoto, replaceGalleryPhoto, saveCommunityBobblehead, setGalleryPhotoAsMain } from "@/lib/adminEdit";
import { useApprovedPhotos } from "@/lib/approvedPhotos";
import { ATHLETICS_CITIES, hasCityChoice, resolveAthleticsCity } from "@/lib/athleticsCity";
import { useBobbleheadGallery, type GalleryPhoto } from "@/lib/bobbleheadGallery";
import { useCommunityBobblehead } from "@/lib/communityBobbleheads";
import { publicAsset } from "@/lib/paths";
import { getRarity } from "@/lib/rarity";
import type { Team } from "@/lib/teams";
import { useUserCollection } from "@/lib/userCollections";
import { useUserFavorites } from "@/lib/userFavorites";
import { useUserWanted } from "@/lib/userWanted";

const RARITY_BADGE_CLASSES: Record<string, string> = {
  "ultra-rare": "bg-purple-700 text-white",
  rare: "bg-purple-600 text-white",
  limited: "brass-plate text-navy-deep",
};

function Shell({ team, children }: { team: Team; children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col px-4 py-10" style={{ background: "var(--page-gradient)" }}>
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-border-soft bg-surface p-6">
        <Link
          href={`/teams/${team.slug}`}
          className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-navy hover:text-accent-hover"
        >
          <span aria-hidden>←</span>
          Back to team
        </Link>
        {children}
      </div>
    </div>
  );
}

export function CommunityBobbleheadPage({
  team,
  bobbleheadId: bobbleheadIdProp,
}: {
  team: Team;
  /** provided by the /community/[bobbleheadId] route; the legacy ?id= URL
      falls back to the query param */
  bobbleheadId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const bobbleheadId = bobbleheadIdProp ?? searchParams.get("id") ?? "";
  const { canEditTeam, user: adminUser } = useAdminAuth();
  const canEdit = canEditTeam(team.slug);
  const { showError } = useToast();
  const { communityBobblehead, isLoading, notFound } = useCommunityBobblehead(team.slug, bobbleheadId);
  const { photoUrlById } = useApprovedPhotos(team.slug);
  const { photos: galleryPhotos, removePhotoLocally, addPhotoLocally, replacePhotoLocally } = useBobbleheadGallery(team.slug, bobbleheadId);
  const { ownedById, isLoggedIn, isLoading: isCollectionLoading, setOwned } = useUserCollection(team.slug);
  const { favoritedById, isLoggedIn: isLoggedInForFavorites, setFavorited } = useUserFavorites(team.slug);
  const { wantedById, isLoggedIn: isLoggedInForWanted, setWanted } = useUserWanted(team.slug);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isManagingPhotos, setIsManagingPhotos] = useState(false);
  const [localOverride, setLocalOverride] = useState<EditBobbleheadValues | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [mainPhotoRemoved, setMainPhotoRemoved] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Shell team={team}>
        <div className="mt-8 rounded-lg border border-border-soft bg-surface-muted p-8 text-center">
          <p className="text-sm font-black uppercase tracking-wide text-navy">Loading bobblehead</p>
        </div>
      </Shell>
    );
  }

  if (notFound || !communityBobblehead) {
    return (
      <Shell team={team}>
        <div className="mt-8 rounded-lg border border-dashed border-border-soft bg-surface-muted p-8 text-center">
          <p className="text-sm font-black uppercase tracking-wide text-navy">Bobblehead not found</p>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            This bobblehead isn&apos;t in the catalog. It may still be pending review.
          </p>
        </div>
      </Shell>
    );
  }

  const giveaway = communityBobblehead;
  const title = localOverride?.title ?? giveaway.title;
  const nickname = localOverride?.nickname ?? giveaway.nickname ?? null;
  const quantity = localOverride?.quantity ?? giveaway.quantity ?? null;
  const date = localOverride?.date ?? giveaway.date;
  // Year is no longer edited directly — it's derived from the date, keeping
  // the stored year when the date doesn't carry one ("N/A").
  const year = extractYear(date, giveaway.year);
  // Athletics only; null for every other team, which drops the row from the
  // info grid and the field from the edit dialog. A just-saved edit wins
  // outright rather than falling through on null.
  const city = resolveAthleticsCity(team.slug, year, localOverride ? localOverride.city : giveaway.city);
  // A community listing's photo is always admin-removable: either an
  // approved_photos row or the row's own image_url.
  const removableMainPhotoUrl = mainPhotoRemoved
    ? null
    : (localImageUrl ?? photoUrlById[giveaway.id] ?? giveaway.imageUrl ?? null);
  // With no profile photo of its own, a listing borrows its first gallery
  // photo as the profile image rather than showing the team placeholder.
  const galleryFallbackUrl = galleryPhotos[0]?.imageUrl ?? null;
  const defaultPhotoUrl = removableMainPhotoUrl ?? galleryFallbackUrl;
  const hasRealPhoto = Boolean(defaultPhotoUrl);
  const imageSrc = selectedPhotoUrl ?? defaultPhotoUrl ?? publicAsset(`/bobbleheads/${team.slug}.png`);
  const thumbnails = [
    ...(defaultPhotoUrl ? [defaultPhotoUrl] : []),
    ...galleryPhotos.map((photo) => photo.imageUrl).filter((url) => url !== defaultPhotoUrl),
  ];
  // Don't show the photo twice when it's standing in as the profile image —
  // except while managing, where hiding it was the reason a listing whose only
  // photo is a gallery photo had no way to remove or swap that photo at all.
  const galleryPhotosToShow = isManagingPhotos
    ? galleryPhotos
    : galleryPhotos.filter((photo) => photo.imageUrl !== defaultPhotoUrl);
  const isOwned = ownedById[giveaway.id] ?? false;
  // Until the collection loads client-side we can't tell owned from unowned;
  // keep the button neutral rather than flashing an owned item as unowned.
  const ownershipKnown = !isCollectionLoading;
  const isFavorited = favoritedById[giveaway.id] ?? false;
  const isWanted = wantedById[giveaway.id] ?? false;
  const rarity = getRarity(quantity);
  const { primary: primaryName, secondary: descriptor } = resolveTitleParts(title, nickname);
  const details: [string, string][] = [
    ["Release Date", date],
    ...(city ? [["City", city] as [string, string]] : []),
    ...(quantity?.trim() ? [["Quantity Issued", quantity] as [string, string]] : []),
  ];
  const story = `This ${primaryName} bobblehead was added by the community for ${team.city} ${team.name} fans${
    date && date !== "N/A" ? ` and given away on ${date}` : year !== "Unknown" ? ` in ${year}` : ""
  }${quantity?.trim() ? `, with ${quantity} issued` : ""}.`;

  // Marking something owned also removes it from the wanted list — you no
  // longer "want" what's on your shelf (un-owning doesn't re-add it).
  const handleToggleOwned = () => {
    if (!isOwned && isWanted) setWanted(giveaway.id, false);
    setOwned(giveaway.id, !isOwned);
  };

  const handleEditSave = async (values: EditBobbleheadValues, file: File | null) => {
    if (!adminUser) return;

    const { imageUrl } = await saveCommunityBobblehead({
      user: adminUser,
      teamSlug: team.slug,
      bobbleheadId: giveaway.id,
      title: values.title,
      nickname: values.nickname,
      quantity: values.quantity,
      year: extractYear(values.date, year),
      date: values.date,
      city: values.city,
      file: file ?? undefined,
    });

    setLocalOverride(values);
    if (imageUrl) {
      setLocalImageUrl(imageUrl);
      setMainPhotoRemoved(false);
    }
  };

  const handleDelete = async () => {
    await deleteBobblehead({ teamSlug: team.slug, bobbleheadId: giveaway.id, source: "community" });
    router.replace(`/teams/${team.slug}`);
  };

  const handleRemoveMainPhoto = async () => {
    await deleteMainPhoto({
      teamSlug: team.slug,
      bobbleheadId: giveaway.id,
      source: "community",
      imageUrl: removableMainPhotoUrl,
    });
    setLocalImageUrl(null);
    setMainPhotoRemoved(true);
  };

  const handleDeleteGalleryPhoto = async (photo: GalleryPhoto) => {
    if (!window.confirm("Remove this photo for everyone?")) return;

    try {
      await deleteGalleryPhoto(photo);
      removePhotoLocally(photo.id);
      // Otherwise the big photo keeps pointing at the file we just deleted.
      if (photo.imageUrl === selectedPhotoUrl) setSelectedPhotoUrl(null);
    } catch (deleteError) {
      showError(deleteError instanceof Error ? deleteError.message : "Could not remove the photo.");
    }
  };

  const handleReplaceGalleryPhoto = async (photo: GalleryPhoto, file: File) => {
    if (!adminUser) return;

    try {
      const replacement = await replaceGalleryPhoto({
        user: adminUser,
        teamSlug: team.slug,
        bobbleheadId: giveaway.id,
        photo,
        file,
      });
      replacePhotoLocally(photo.id, replacement);
      // Keep the big photo pointed at the swap rather than at a URL whose file
      // has just been deleted.
      if (photo.imageUrl === imageSrc) setSelectedPhotoUrl(replacement.imageUrl);
    } catch (replaceError) {
      showError(replaceError instanceof Error ? replaceError.message : "Could not replace the photo.");
    }
  };

  const handleSetGalleryPhotoAsMain = async (photo: GalleryPhoto) => {
    if (!adminUser) return;

    try {
      // The photo currently serving as the profile image moves down into the
      // gallery. A community listing's main is always in removableMainPhotoUrl;
      // the gallery-fallback and team placeholder don't count (the fallback is
      // already a gallery row and the placeholder isn't a real photo).
      const { demotedPhoto } = await setGalleryPhotoAsMain({
        user: adminUser,
        teamSlug: team.slug,
        bobbleheadId: giveaway.id,
        photo,
        previousMainUrl: removableMainPhotoUrl,
      });
      setLocalImageUrl(photo.imageUrl);
      setMainPhotoRemoved(false);
      removePhotoLocally(photo.id);
      if (demotedPhoto) addPhotoLocally(demotedPhoto);
    } catch (promoteError) {
      showError(promoteError instanceof Error ? promoteError.message : "Could not set the profile photo.");
    }
  };

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <div className="sticky top-14 z-30 border-b border-border-soft bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-11 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex shrink-0 items-center gap-1.5 text-sm font-black uppercase tracking-wide text-navy transition hover:text-accent-hover"
            >
              <span aria-hidden>←</span> Back
            </button>
            <Link
              href={`/teams/${team.slug}`}
              className="truncate text-sm font-semibold text-zinc-600 transition hover:text-accent-hover"
            >
              {team.name} team page
            </Link>
          </div>
          <span className="shrink-0 rounded bg-accent/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-accent">
            Community submission
          </span>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Left column: photo + about + details */}
          <div className="flex flex-col gap-5">
            <div className="relative overflow-hidden rounded-xl border border-border-soft bg-white">
              {hasRealPhoto ? (
                <span className="absolute left-3 top-3 z-10 rounded bg-navy/85 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                  Community photo
                </span>
              ) : null}
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                <FavoriteButton
                  isFavorited={isFavorited}
                  isLoggedIn={isLoggedInForFavorites}
                  onToggle={() => setFavorited(giveaway.id, !isFavorited)}
                  itemLabel={title}
                  className="h-9 w-9 text-lg"
                />
              </div>
              {hasRealPhoto ? (
                // No min-height: the frame takes the shape of the photo. See the
                // matching block in CuratedBobbleheadPage.
                <div className="flex items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#ffffff,#f2ead9_85%)] p-6">
                  <EnlargeablePhoto
                    src={imageSrc}
                    alt={`${team.city} ${team.name} ${title} bobblehead`}
                    width={800}
                    height={800}
                    fitHeight={480}
                    className="object-contain mix-blend-multiply drop-shadow-[0_16px_20px_rgba(58,36,18,0.3)]"
                  />
                </div>
              ) : (
                <div className="flex min-h-80 flex-col items-center justify-center gap-4 bg-[radial-gradient(circle_at_50%_30%,#ffffff,#f2ead9_85%)] p-8 text-center sm:min-h-[28rem]">
                  <EnlargeablePhoto
                    src={imageSrc}
                    alt={`${team.city} ${team.name} placeholder bobblehead`}
                    width={268}
                    height={630}
                    className="h-40 w-auto object-contain opacity-70"
                  />
                  <p className="font-display text-lg font-bold uppercase tracking-wide text-navy">
                    No photo yet
                  </p>
                  <p className="max-w-sm text-sm leading-6 text-zinc-600">
                    Nobody has shared a photo of this bobblehead. Have one on your shelf?
                  </p>
                  <SubmitPhotoButton
                    bobbleheadId={giveaway.id}
                    teamSlug={team.slug}
                    label="Submit the first photo"
                    className="inline-flex cursor-pointer items-center gap-2 rounded bg-accent px-5 py-2.5 font-display text-sm font-bold uppercase tracking-wider text-accent-fg transition hover:bg-accent-hover"
                  >
                    <span aria-hidden>▣</span> Submit the first photo
                  </SubmitPhotoButton>
                </div>
              )}
            </div>

            {thumbnails.length > 1 ? (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {thumbnails.map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setSelectedPhotoUrl(url)}
                    aria-label="Show this photo"
                    aria-pressed={url === imageSrc}
                    className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition ${
                      url === imageSrc ? "border-accent" : "border-border-soft hover:border-accent/50"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-contain" />
                  </button>
                ))}
              </div>
            ) : null}

            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
                About This Bobblehead
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{story}</p>
            </div>

            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
                Details
              </h2>
              <dl className="mt-3 divide-y divide-border-soft">
                {details.map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-6 py-2.5">
                    <dt className="text-sm font-semibold text-zinc-500">{label}</dt>
                    <dd className="text-right text-sm font-semibold text-navy">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* Right rail */}
          <div className="flex flex-col gap-5">
            <div>
              <Link href={`/teams/${team.slug}`} className="inline-block">
                <NamePlate variant="brass">{team.city} {team.name}</NamePlate>
              </Link>
              <h1 className="mt-3 font-display text-4xl font-bold uppercase leading-none tracking-wide text-navy sm:text-5xl">
                {primaryName}
              </h1>
              {descriptor ? (
                <p className="mt-2 text-lg font-semibold text-zinc-600">{descriptor}</p>
              ) : null}
              {rarity ? (
                <span
                  className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${RARITY_BADGE_CLASSES[rarity.tier]}`}
                >
                  <span aria-hidden>◆</span> {rarity.label}
                </span>
              ) : null}
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                aria-pressed={isOwned}
                disabled={!isLoggedIn || !ownershipKnown}
                onClick={handleToggleOwned}
                className={`w-full rounded-lg px-5 py-3.5 font-display text-base font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isLoggedIn && !ownershipKnown
                    ? "border border-border-soft text-zinc-500"
                    : isOwned
                      ? "bg-green-600 text-white hover:bg-green-500"
                      : "bg-accent text-accent-fg hover:bg-accent-hover"
                }`}
              >
                {!isLoggedIn
                  ? "Log in to track"
                  : !ownershipKnown
                    ? "Loading…"
                    : isOwned
                      ? "✓ I Own It"
                      : "I Own It"}
              </button>
              <button
                type="button"
                aria-pressed={isWanted}
                onClick={() => {
                  if (!isLoggedInForWanted) return;
                  setWanted(giveaway.id, !isWanted);
                }}
                disabled={!isLoggedInForWanted}
                className={`w-full rounded-lg border px-5 py-3.5 font-display text-base font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isWanted
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-accent text-accent hover:bg-accent hover:text-accent-fg"
                }`}
              >
                {isWanted ? "★ Wanted" : "☆ Want It"}
              </button>
            </div>

            {rarity ? (
              <div className="rounded-xl border border-border-soft bg-surface p-5">
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
                  Rarity
                </h2>
                <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${RARITY_BADGE_CLASSES[rarity.tier]}`}>
                  <span aria-hidden>◆</span> {rarity.label}
                </p>
                <p className="mt-2 text-sm text-zinc-600">{rarity.reason}.</p>
              </div>
            ) : null}

            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
                  Community Photos{galleryPhotosToShow.length > 0 ? ` (${galleryPhotosToShow.length})` : ""}
                </h2>
                <div className="flex shrink-0 items-center gap-3">
                  {canEdit && galleryPhotos.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setIsManagingPhotos((current) => !current)}
                      className="cursor-pointer text-xs font-black uppercase tracking-wide text-navy transition hover:text-accent"
                    >
                      {isManagingPhotos ? "Done" : "Manage"}
                    </button>
                  ) : null}
                  <SubmitPhotoButton
                    bobbleheadId={giveaway.id}
                    teamSlug={team.slug}
                    label="Add photos"
                    className="cursor-pointer text-xs font-black uppercase tracking-wide text-accent transition hover:text-accent-hover"
                  >
                    + Add photos
                  </SubmitPhotoButton>
                </div>
              </div>
              {galleryPhotosToShow.length > 0 ? (
                <div className="mt-3">
                  <PhotoGallery
                    photos={galleryPhotosToShow}
                    isManaging={canEdit && isManagingPhotos}
                    currentMainUrl={defaultPhotoUrl}
                    onDelete={canEdit ? handleDeleteGalleryPhoto : undefined}
                    onSetAsMain={canEdit ? handleSetGalleryPhotoAsMain : undefined}
                    onReplace={canEdit ? handleReplaceGalleryPhoto : undefined}
                  />
                </div>
              ) : (
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  No community photos yet — submit one and it&apos;ll appear here after review.
                </p>
              )}
            </div>

            {canEdit ? (
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border-soft bg-surface px-5 py-3 text-sm font-bold uppercase tracking-wide text-navy transition hover:border-accent hover:text-accent"
              >
                <span aria-hidden>✎</span>
                Edit bobblehead (admin)
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface px-6 py-5 sm:flex-row">
          <p className="text-sm text-zinc-700">
            <span aria-hidden>ⓘ</span> Found an error or have more info? Help keep our database accurate.
          </p>
          <ReportListingButton
            teamSlug={team.slug}
            bobbleheadId={giveaway.id}
            source="community"
            title={title}
            label="✎ Submit an Update"
            className="shrink-0 rounded border border-accent px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-accent transition hover:bg-accent hover:text-accent-fg"
          />
        </div>
      </div>

      {isEditOpen ? (
        <EditBobbleheadDialog
          onClose={() => setIsEditOpen(false)}
          initial={{ title, nickname: nickname ?? "", quantity: quantity ?? "", date, city }}
          onSave={handleEditSave}
          onDelete={handleDelete}
          onRemovePhoto={removableMainPhotoUrl ? handleRemoveMainPhoto : undefined}
          cityOptions={hasCityChoice(team.slug) ? ATHLETICS_CITIES : undefined}
        />
      ) : null}
    </div>
  );
}
