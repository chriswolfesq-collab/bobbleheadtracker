"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EnlargeablePhoto } from "@/components/EnlargeablePhoto";
import { resolveTitleParts } from "@/components/BobbleheadTitle";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CollectionDetails } from "@/components/CollectionDetails";
import { EditBobbleheadDialog, type EditBobbleheadValues } from "@/components/EditBobbleheadDialog";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ListingNavControls, ListingNavCounter } from "@/components/ListingNavControls";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ReportListingButton } from "@/components/ReportListingDialog";
import { SubmitPhotoButton } from "@/components/SubmitPhotoDialog";
import { TagList } from "@/components/TagList";
import { useToast } from "@/components/Toast";
import { WantedButton } from "@/components/WantedButton";
import { NamePlate } from "@/components/ui/NamePlate";
import { useAdminAuth } from "@/lib/adminAuth";
import { deleteBobblehead, deleteGalleryPhoto, deleteMainPhoto, hideCuratedSeedPhoto, replaceGalleryPhoto, saveCuratedBobblehead, setGalleryPhotoAsMain } from "@/lib/adminEdit";
import { useApprovedPhotos } from "@/lib/approvedPhotos";
import { ATHLETICS_CITIES, hasCityChoice, resolveAthleticsCity } from "@/lib/athleticsCity";
import type { Giveaway } from "@/lib/bobbleheads";
import { useBobbleheadGallery, type GalleryPhoto } from "@/lib/bobbleheadGallery";
import { useBobbleheadOverride, type BobbleheadOverride } from "@/lib/bobbleheadOverrides";
import { copyText } from "@/lib/clipboard";
import { extractYear } from "@/lib/extractYear";
import type { ListingNav } from "@/lib/listingNav";
import { publicAsset } from "@/lib/paths";
import { getRarity } from "@/lib/rarity";
import { siteUrl } from "@/lib/siteUrl";
import type { Team } from "@/lib/teams";
import { useListingNav } from "@/lib/listingTrail";
import { teamHrefFromView, useTeamView } from "@/lib/teamView";
import { useUserCollection } from "@/lib/userCollections";
import { useUserFavorites } from "@/lib/userFavorites";
import { useUserWanted } from "@/lib/userWanted";

const RARITY_BADGE_CLASSES: Record<string, string> = {
  "ultra-rare": "bg-purple-700 text-white",
  rare: "bg-purple-600 text-white",
  limited: "brass-plate text-navy-deep",
};

function ShareCard({ url, title }: { url: string; title: string }) {
  const { showError } = useToast();
  const [copied, setCopied] = useState(false);
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(`${title} bobblehead`);
  const shareLinkClass =
    "grid h-10 w-10 place-items-center rounded-full border border-border-soft bg-white text-navy transition hover:border-accent hover:text-accent";

  return (
    <div className="rounded-xl border border-border-soft bg-surface p-5">
      <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">Share</h2>
      <div className="mt-3 flex items-center gap-2.5">
        <button
          type="button"
          aria-label="Copy link"
          title="Copy link"
          onClick={async () => {
            const ok = await copyText(url);
            if (!ok) {
              showError("Couldn't copy the link.");
              return;
            }
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={shareLinkClass}
        >
          <span aria-hidden>{copied ? "✓" : "🔗"}</span>
        </button>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on Facebook"
          title="Share on Facebook"
          className={shareLinkClass}
        >
          <span aria-hidden className="font-black">f</span>
        </a>
        <a
          href={`https://x.com/intent/post?url=${encodedUrl}&text=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on X"
          title="Share on X"
          className={shareLinkClass}
        >
          <span aria-hidden className="font-black">𝕏</span>
        </a>
        <a
          href={`https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on Reddit"
          title="Share on Reddit"
          className={shareLinkClass}
        >
          <span aria-hidden className="text-xs font-black">reddit</span>
        </a>
      </div>
      {copied ? <p className="mt-2 text-xs font-semibold text-green-700">Link copied.</p> : null}
    </div>
  );
}

export function CuratedBobbleheadPage({
  giveaway,
  team,
  initialOverride,
  initialImageUrl,
  nav: serverNav,
}: {
  giveaway: Giveaway;
  team: Team;
  initialOverride: BobbleheadOverride | null;
  initialImageUrl: string | null;
  nav: ListingNav;
}) {
  const router = useRouter();
  const teamView = useTeamView();
  // The team chain ships in the prerendered HTML; if the reader arrived from a
  // list (Recently Added, search, a tag, a filtered team view) the arrows and
  // the counter switch to that list after hydration. See lib/listingTrail.ts.
  const nav = useListingNav(serverNav) ?? serverNav;
  const { canEditTeam, user: adminUser } = useAdminAuth();
  const canEdit = canEditTeam(team.slug);
  const { showError } = useToast();
  const { photoUrlById } = useApprovedPhotos(
    team.slug,
    initialImageUrl ? { [giveaway.id]: initialImageUrl } : {},
  );
  const { photos: galleryPhotos, removePhotoLocally, addPhotoLocally, replacePhotoLocally } = useBobbleheadGallery(team.slug, giveaway.id);
  const { override, isLoading: isOverrideLoading } = useBobbleheadOverride(team.slug, giveaway.id, {
    override: initialOverride,
  });
  const { ownedById, isLoggedIn, isLoading: isCollectionLoading, setOwned } = useUserCollection(team.slug);
  const { favoritedById, isLoggedIn: isLoggedInForFavorites, setFavorited } = useUserFavorites(team.slug);
  const { wantedById, isLoggedIn: isLoggedInForWanted, setWanted } = useUserWanted(team.slug);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isManagingPhotos, setIsManagingPhotos] = useState(false);
  const [localOverride, setLocalOverride] = useState<EditBobbleheadValues | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [mainPhotoRemoved, setMainPhotoRemoved] = useState(false);
  const [seedPhotoRemoved, setSeedPhotoRemoved] = useState(false);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);

  // The page itself is statically generated from the hardcoded giveaway list;
  // the server 404s deleted listings, but an admin can also delete one live
  // from this very page — the tombstone covers that.
  if (!isOverrideLoading && override?.deleted) {
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
          <div className="mt-8 rounded-lg border border-dashed border-border-soft bg-surface-muted p-8 text-center">
            <p className="text-sm font-black uppercase tracking-wide text-navy">Bobblehead removed</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              The site admin removed this listing from the catalog.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const title = localOverride?.title ?? override?.title ?? giveaway.title;
  const nickname = localOverride?.nickname ?? override?.nickname ?? giveaway.nickname ?? null;
  const quantity = localOverride?.quantity ?? override?.quantity ?? giveaway.quantity ?? null;
  const date = localOverride?.date ?? override?.date ?? giveaway.date;
  // Year is no longer edited directly — it's derived from the date, keeping
  // the stored year when the date doesn't carry one ("N/A").
  const year = extractYear(date, override?.year ?? giveaway.year);
  // Athletics only; null for every other team, which drops the row from the
  // info grid and the field from the edit dialog.
  // A just-saved edit wins outright rather than falling through on null, so
  // clearing the pick isn't undone by the stale stored value.
  const city = resolveAthleticsCity(team.slug, year, localOverride ? localOverride.city : override?.city);
  // What a fan actually calls the team on this listing: "Oakland Athletics" for
  // a Coliseum-era giveaway, "Sacramento Athletics" for a Sutter Health Park
  // one. TEAMS carries only the current city, which reads as wrong on the back
  // catalog; every other team has one city and falls straight through.
  const cityName = city ?? team.city;
  // Two layers can supply the profile photo. The approved_photos row (or one the
  // admin just uploaded) sits on top and is removed by deleting it; underneath
  // is the curated seed imageUrl, build-time data with no row of its own, which
  // is removed by flagging the override instead (photoHidden).
  const approvedMainPhotoUrl = mainPhotoRemoved ? null : (localImageUrl ?? photoUrlById[giveaway.id] ?? null);
  const seedPhotoUrl = seedPhotoRemoved || override?.photoHidden ? null : (giveaway.imageUrl ?? null);
  const mainPhotoUrl = approvedMainPhotoUrl ?? seedPhotoUrl;
  // With no profile photo of its own, a listing borrows its first gallery
  // photo as the profile image rather than showing the team placeholder.
  const galleryFallbackUrl = galleryPhotos[0]?.imageUrl ?? null;
  const defaultPhotoUrl = mainPhotoUrl ?? galleryFallbackUrl;
  const hasRealPhoto = Boolean(defaultPhotoUrl);
  // The community-photo tag applies when the showing photo came from the
  // community pipeline (approved/gallery), not the curated seed data.
  const isCommunityPhoto = hasRealPhoto && !seedPhotoUrl;
  const placeholderSrc = publicAsset(`/bobbleheads/${team.slug}.png`);
  const imageSrc = selectedPhotoUrl ?? defaultPhotoUrl ?? placeholderSrc;
  // Thumbnails: the profile photo plus every distinct gallery photo.
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
  // The collection loads client-side after mount, so until it arrives we don't
  // actually know whether this bobblehead is owned — treating "not yet loaded"
  // as "not owned" is what made an owned item flash its unowned state on a
  // fresh navigation. Gate the owned UI on this so it stays neutral until known.
  const ownershipKnown = !isCollectionLoading;
  const isFavorited = favoritedById[giveaway.id] ?? false;
  const isWanted = wantedById[giveaway.id] ?? false;
  // Hand-set, never derived: a listing shows a badge only because someone
  // marked it one, which is why an unknown-quantity piece can carry one and a
  // small print run on its own doesn't. A just-saved edit wins outright so
  // clearing the badge isn't undone by the stored value.
  const rarity = localOverride
    ? getRarity(localOverride.rarity, localOverride.rarityNote)
    : getRarity(override?.rarity, override?.rarityNote);
  const { primary: primaryName, secondary: descriptor } = resolveTitleParts(title, nickname);
  const pageUrl = `${siteUrl()}/teams/${team.slug}/bobbleheads/${giveaway.id}`;

  const details: [string, string][] = [
    ["Release Date", date],
    ...(city ? [["City", city] as [string, string]] : []),
    ...(giveaway.distribution ? [["Distribution", giveaway.distribution] as [string, string]] : []),
    ...(quantity?.trim() ? [["Quantity Issued", quantity] as [string, string]] : []),
  ];

  const story =
    giveaway.story ??
    `This ${primaryName} bobblehead was given away to ${cityName} ${team.name} fans${
      date && date !== "N/A" ? ` on ${date}` : year !== "Unknown" ? ` in ${year}` : ""
    }${quantity?.trim() ? `, with ${quantity} issued` : ""}.`;

  // Owned and wanted are mutually exclusive: you don't want what's already on
  // your shelf, and something you're still hunting for isn't on it. Whichever
  // you pick clears the other; clearing either one leaves the other alone
  // (un-owning doesn't re-add to wanted, and vice versa).
  const handleToggleOwned = () => {
    if (!isOwned && isWanted) setWanted(giveaway.id, false);
    setOwned(giveaway.id, !isOwned);
  };

  const handleToggleWanted = () => {
    if (!isWanted && isOwned) setOwned(giveaway.id, false);
    setWanted(giveaway.id, !isWanted);
  };

  const handleEditSave = async (values: EditBobbleheadValues, file: File | null) => {
    if (!adminUser) return;

    const { imageUrl } = await saveCuratedBobblehead({
      user: adminUser,
      teamSlug: team.slug,
      bobbleheadId: giveaway.id,
      title: values.title,
      nickname: values.nickname,
      quantity: values.quantity,
      year: extractYear(values.date, year),
      date: values.date,
      city: values.city,
      rarity: values.rarity,
      rarityNote: values.rarityNote,
      file: file ?? undefined,
    });

    setLocalOverride(values);
    if (imageUrl) {
      setLocalImageUrl(imageUrl);
      setMainPhotoRemoved(false);
    }
  };

  const handleDelete = async () => {
    await deleteBobblehead({ teamSlug: team.slug, bobbleheadId: giveaway.id, source: "curated" });
    router.replace(`/teams/${team.slug}`);
  };

  // Peels off one layer at a time: with an approved photo showing, this removes
  // it and reveals whatever curated seed photo was underneath; a second removal
  // hides the seed too. That keeps the pre-existing "fall back to the seed"
  // behavior intact while still letting a seed photo be cleared.
  const handleRemoveMainPhoto = async () => {
    if (!approvedMainPhotoUrl) {
      if (!adminUser) return;

      await hideCuratedSeedPhoto({ user: adminUser, teamSlug: team.slug, bobbleheadId: giveaway.id });
      setSeedPhotoRemoved(true);
      return;
    }

    await deleteMainPhoto({
      teamSlug: team.slug,
      bobbleheadId: giveaway.id,
      source: "curated",
      imageUrl: approvedMainPhotoUrl,
    });
    setLocalImageUrl(null);
    setMainPhotoRemoved(true);
  };

  // Confirmed in the gallery's own controls, not by window.confirm — see the
  // note on ManageControls in components/PhotoGallery.tsx.
  const handleDeleteGalleryPhoto = async (photo: GalleryPhoto) => {
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
      // has just been deleted — it's showing this photo whenever it was picked
      // from the thumbnail strip, or when it's the gallery one standing in as
      // the profile image.
      if (photo.imageUrl === imageSrc) setSelectedPhotoUrl(replacement.imageUrl);
    } catch (replaceError) {
      showError(replaceError instanceof Error ? replaceError.message : "Could not replace the photo.");
    }
  };

  const handleSetGalleryPhotoAsMain = async (photo: GalleryPhoto) => {
    if (!adminUser) return;

    try {
      // The photo currently serving as the profile image moves down into the
      // gallery. The curated seed counts (it's what shows with no approved
      // photo); the gallery-fallback and team placeholder don't — the fallback
      // is already a gallery row and the placeholder isn't a real photo. A seed
      // the admin already removed doesn't come back this way either.
      const previousMainUrl = mainPhotoUrl;
      const { demotedPhoto } = await setGalleryPhotoAsMain({
        user: adminUser,
        teamSlug: team.slug,
        bobbleheadId: giveaway.id,
        photo,
        previousMainUrl,
      });
      setLocalImageUrl(photo.imageUrl);
      setMainPhotoRemoved(false);
      removePhotoLocally(photo.id);
      if (demotedPhoto) addPhotoLocally(demotedPhoto);
    } catch (promoteError) {
      showError(promoteError instanceof Error ? promoteError.message : "Could not set the profile photo.");
    }
  };

  const ownButtonClass = `w-full rounded-lg px-5 py-3.5 font-display text-base font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${
    isLoggedIn && !ownershipKnown
      ? "border border-border-soft text-zinc-500"
      : isOwned
        ? "bg-green-600 text-white hover:bg-green-500"
        : "bg-accent text-accent-fg hover:bg-accent-hover"
  }`;

  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      {/* Persistent nav bar: back button and breadcrumb trail (both from
          `Breadcrumbs`), then the position counter. */}
      <div className="sticky top-14 z-30 border-b border-border-soft bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-11 w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            <Breadcrumbs
              items={[
                { href: "/", label: "Home" },
                { href: "/teams", label: "Teams" },
                // Back to the tab/filter/page the reader left, when they came
                // from the team page (lib/teamView.ts).
                { href: teamHrefFromView(team.slug, teamView), label: team.name },
                { label: title },
              ]}
            />
          </div>
          <ListingNavCounter nav={nav} />
        </div>
      </div>

      {/* Prev/next edge arrows */}
      <ListingNavControls nav={nav} teamView={teamView} />

      <div className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          {/* Left column: photo + about + details */}
          <div className="flex flex-col gap-5">
            <div className="relative overflow-hidden rounded-xl border border-border-soft bg-white">
              {isCommunityPhoto ? (
                <span className="absolute left-3 top-3 z-10 rounded bg-navy/85 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                  Community photo
                </span>
              ) : null}
              {/* Star then heart, in the same order as the corner of a card on
                  the team page — the two icons should mean the same thing and
                  sit in the same place wherever you meet a bobblehead. */}
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
                <WantedButton
                  isWanted={isWanted}
                  isLoggedIn={isLoggedInForWanted}
                  onToggle={handleToggleWanted}
                  itemLabel={title}
                  className="h-9 w-9 text-lg"
                />
                <FavoriteButton
                  isFavorited={isFavorited}
                  isLoggedIn={isLoggedInForFavorites}
                  onToggle={() => setFavorited(giveaway.id, !isFavorited)}
                  itemLabel={title}
                  className="h-9 w-9 text-lg"
                />
              </div>
              {hasRealPhoto ? (
                // No min-height: the frame hugs whatever shape the photo is.
                // Listing photos are a real mix — roughly two thirds portrait,
                // a quarter square, the rest landscape — so a fixed box left a
                // band of dead space above and below most of them.
                <div className="flex items-center justify-center bg-[radial-gradient(circle_at_50%_30%,#ffffff,#f2ead9_85%)] p-6">
                  <EnlargeablePhoto
                    src={imageSrc}
                    fallbackSrc={placeholderSrc}
                    alt={`${team.city} ${team.name} ${title} bobblehead`}
                    width={800}
                    height={800}
                    // Sizing is owned by fitHeight, not by classes here: the
                    // 800x800 above is only a placeholder ratio to start from.
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

          {/* Right rail: identity + actions */}
          <div className="flex flex-col gap-5">
            <div>
              <Link href={`/teams/${team.slug}`} className="inline-block">
                <NamePlate variant="brass">{cityName} {team.name}</NamePlate>
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
                className={ownButtonClass}
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
                  handleToggleWanted();
                }}
                disabled={!isLoggedInForWanted}
                className={`w-full rounded-lg border px-5 py-3.5 font-display text-base font-bold uppercase tracking-wider transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isWanted
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-accent text-accent hover:bg-accent hover:text-accent-fg"
                }`}
              >
                {/* "Add to Wanted", not "Want It": the list this fills is called
                    Wanted on the team page and the profile, and the button
                    should name it rather than invent a third word for it. */}
                {isWanted ? "★ Wanted" : "☆ Add to Wanted"}
              </button>
            </div>

            <div className="rounded-xl border border-border-soft bg-surface p-5">
              <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
                Collection Status
              </h2>
              {!isLoggedIn ? (
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Log in to track this bobblehead in your collection.
                </p>
              ) : !ownershipKnown ? (
                <p className="mt-2 text-sm text-zinc-500">Loading your collection…</p>
              ) : isOwned ? (
                <>
                  <p className="mt-2 text-sm font-semibold text-green-700">
                    You own this bobblehead.
                  </p>
                  <CollectionDetails teamSlug={team.slug} bobbleheadId={giveaway.id} />
                </>
              ) : (
                <p className="mt-2 text-sm leading-6 text-zinc-600">
                  Not on your shelf yet{isWanted ? " — it's on your wanted list." : "."}
                </p>
              )}
            </div>

            <TagList teamSlug={team.slug} bobbleheadId={giveaway.id} />

            {rarity ? (
              <div className="rounded-xl border border-border-soft bg-surface p-5">
                <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
                  Rarity
                </h2>
                <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black uppercase tracking-wider ${RARITY_BADGE_CLASSES[rarity.tier]}`}>
                  <span aria-hidden>◆</span> {rarity.label}
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  {rarity.note ?? "Marked by the BobbleShelf team."}
                </p>
              </div>
            ) : null}

            <ShareCard url={pageUrl} title={title} />

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

        {nav.related.length > 0 ? (
          <div className="mt-8">
            <h2 className="font-display text-base font-bold uppercase tracking-wide text-navy">
              More {team.name} bobbleheads
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {nav.related.map((entry) => (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className="rounded-full border border-border-soft bg-surface px-3.5 py-1.5 text-sm font-semibold text-navy transition hover:border-accent hover:text-accent"
                >
                  {entry.title}
                </Link>
              ))}
            </div>
          </div>
        ) : null}

        {/* Bottom bar: report/update */}
        <div className="mt-8 flex flex-col items-center justify-between gap-3 rounded-xl border border-border-soft bg-surface px-6 py-5 sm:flex-row">
          <p className="text-sm text-zinc-700">
            <span aria-hidden>ⓘ</span> Found an error or have more info? Help keep our database accurate.
          </p>
          <ReportListingButton
            teamSlug={team.slug}
            bobbleheadId={giveaway.id}
            source="curated"
            title={title}
            label="✎ Submit an Update"
            className="shrink-0 rounded border border-accent px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-accent transition hover:bg-accent hover:text-accent-fg"
          />
        </div>
      </div>

      {isEditOpen ? (
        <EditBobbleheadDialog
          onClose={() => setIsEditOpen(false)}
          initial={{
            title,
            nickname: nickname ?? "",
            quantity: quantity ?? "",
            date,
            city,
            rarity: rarity?.tier ?? null,
            rarityNote: rarity?.note ?? "",
          }}
          onSave={handleEditSave}
          onDelete={handleDelete}
          onRemovePhoto={mainPhotoUrl ? handleRemoveMainPhoto : undefined}
          cityOptions={hasCityChoice(team.slug) ? ATHLETICS_CITIES : undefined}
        />
      ) : null}
    </div>
  );
}
