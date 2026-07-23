"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminModeBadge } from "@/components/AdminModeBadge";
import { AuthWidget } from "@/components/AuthWidget";
import { BobbleheadImage } from "@/components/BobbleheadImage";
import { BobbleheadTitle } from "@/components/BobbleheadTitle";
import { EditBobbleheadDialog, type EditBobbleheadValues } from "@/components/EditBobbleheadDialog";
import { FavoriteButton } from "@/components/FavoriteButton";
import { PhotoGallery } from "@/components/PhotoGallery";
import { ReportListingButton } from "@/components/ReportListingDialog";
import { SubmitPhotoButton } from "@/components/SubmitPhotoDialog";
import { useToast } from "@/components/Toast";
import { WantedButton } from "@/components/WantedButton";
import { useAdminAuth } from "@/lib/adminAuth";
import { deleteBobblehead, deleteGalleryPhoto, deleteMainPhoto, saveCuratedBobblehead, setGalleryPhotoAsMain } from "@/lib/adminEdit";
import { useApprovedPhotos } from "@/lib/approvedPhotos";
import type { Giveaway } from "@/lib/bobbleheads";
import { useBobbleheadGallery, type GalleryPhoto } from "@/lib/bobbleheadGallery";
import { useBobbleheadOverride, type BobbleheadOverride } from "@/lib/bobbleheadOverrides";
import { publicAsset } from "@/lib/paths";
import type { Team } from "@/lib/teams";
import { useUserCollection } from "@/lib/userCollections";
import { useUserFavorites } from "@/lib/userFavorites";
import { useUserWanted } from "@/lib/userWanted";

export function CuratedBobbleheadPage({
  giveaway,
  team,
  initialOverride,
  initialImageUrl,
}: {
  giveaway: Giveaway;
  team: Team;
  initialOverride: BobbleheadOverride | null;
  initialImageUrl: string | null;
}) {
  const router = useRouter();
  const { isAdmin, user: adminUser } = useAdminAuth();
  const { showError } = useToast();
  const { photoUrlById } = useApprovedPhotos(
    team.slug,
    initialImageUrl ? { [giveaway.id]: initialImageUrl } : {},
  );
  const { photos: galleryPhotos, removePhotoLocally, addPhotoLocally } = useBobbleheadGallery(team.slug, giveaway.id);
  const { override, isLoading: isOverrideLoading } = useBobbleheadOverride(team.slug, giveaway.id, {
    override: initialOverride,
  });
  const { ownedById, isLoggedIn, setOwned } = useUserCollection(team.slug);
  const { favoritedById, isLoggedIn: isLoggedInForFavorites, setFavorited } = useUserFavorites(team.slug);
  const { wantedById, isLoggedIn: isLoggedInForWanted, setWanted } = useUserWanted(team.slug);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [localOverride, setLocalOverride] = useState<EditBobbleheadValues | null>(null);
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null);
  const [mainPhotoRemoved, setMainPhotoRemoved] = useState(false);

  // The page itself is statically generated from the hardcoded giveaway list,
  // so a listing the admin deleted still has a route — the tombstone is what
  // tells us it's gone.
  if (!isOverrideLoading && override?.deleted) {
    return (
      <main className="min-h-full bg-slate-50 px-3 py-3 text-zinc-900 dark:bg-[#15110d] dark:text-zinc-100 sm:px-5 sm:py-5">
        <div className="mx-auto max-w-3xl rounded-xl border border-black bg-white p-6 shadow-2xl dark:bg-[#08131f]">
          <Link
            href={`/teams/${team.slug}`}
            className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-zinc-900 hover:text-accent-hover dark:text-white dark:hover:text-accent-hover"
          >
            <span aria-hidden>←</span>
            Back to team
          </Link>
          <div className="mt-8 rounded-lg border border-dashed border-black/10 bg-black/15 p-8 text-center dark:border-white/15">
            <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-zinc-100">Bobblehead removed</p>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              The site admin removed this listing from the catalog.
            </p>
          </div>
        </div>
      </main>
    );
  }

  const title = localOverride?.title ?? override?.title ?? giveaway.title;
  const nickname = localOverride?.nickname ?? override?.nickname ?? giveaway.nickname ?? null;
  const year = localOverride?.year ?? override?.year ?? giveaway.year;
  const date = localOverride?.date ?? override?.date ?? giveaway.date;
  // The removable "main photo" is an approved_photos row (or one the admin
  // just uploaded); the curated seed imageUrl is build-time data and stays.
  const removableMainPhotoUrl = mainPhotoRemoved ? null : (localImageUrl ?? photoUrlById[giveaway.id] ?? null);
  // With no profile photo of its own, a listing borrows its first gallery
  // photo as the profile image rather than showing the team placeholder.
  const galleryFallbackUrl = galleryPhotos[0]?.imageUrl ?? null;
  const imageSrc =
    removableMainPhotoUrl ?? giveaway.imageUrl ?? galleryFallbackUrl ?? publicAsset(`/bobbleheads/${team.slug}.png`);
  // Don't show the photo twice when it's standing in as the profile image.
  const galleryPhotosToShow = galleryPhotos.filter((photo) => photo.imageUrl !== imageSrc);
  const isOwned = ownedById[giveaway.id] ?? false;
  const isFavorited = favoritedById[giveaway.id] ?? false;
  const isWanted = wantedById[giveaway.id] ?? false;
  const details = [
    ["Release Date", date],
    ["Team", `${team.city} ${team.name}`],
  ];

  const handleEditSave = async (values: EditBobbleheadValues, file: File | null) => {
    if (!adminUser) return;

    const { imageUrl } = await saveCuratedBobblehead({
      user: adminUser,
      teamSlug: team.slug,
      bobbleheadId: giveaway.id,
      title: values.title,
      nickname: values.nickname,
      year: values.year,
      date: values.date,
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

  const handleRemoveMainPhoto = async () => {
    await deleteMainPhoto({
      teamSlug: team.slug,
      bobbleheadId: giveaway.id,
      source: "curated",
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
    } catch (deleteError) {
      showError(deleteError instanceof Error ? deleteError.message : "Could not remove the photo.");
    }
  };

  const handleSetGalleryPhotoAsMain = async (photo: GalleryPhoto) => {
    if (!adminUser) return;

    try {
      // The photo currently serving as the profile image moves down into the
      // gallery. The curated seed counts (it's what shows with no approved
      // photo); the gallery-fallback and team placeholder don't — the fallback
      // is already a gallery row and the placeholder isn't a real photo.
      const previousMainUrl = removableMainPhotoUrl ?? giveaway.imageUrl ?? null;
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

  return (
    <main className="min-h-full bg-slate-50 px-3 py-3 text-zinc-900 dark:bg-[#15110d] dark:text-zinc-100 sm:px-5 sm:py-5">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-xl border border-black bg-white shadow-2xl dark:bg-[#08131f]">
        {/* Always-dark team hero; `dark` scopes its contents to dark-surface
            styling so they stay legible when the page is in light mode. */}
        <section
          className="dark border-b border-white/10 p-5"
          style={{
            background: `radial-gradient(circle at 72% 10%, ${team.primary}44, transparent 34%), linear-gradient(135deg, #08131f 0%, #0b1d2e 52%, #07111d 100%)`,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <Link
              href={`/teams/${team.slug}`}
              className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-wide text-white hover:text-accent-hover"
            >
              <span aria-hidden>←</span>
              Back to team
            </Link>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <AdminModeBadge />
              <AuthWidget />
            </div>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-[190px_1fr]">
          <aside className="lg:border-r lg:border-white/10 lg:pr-5">
            <div className="rounded border border-white/15 bg-black/25 p-3 text-center">
              <div className="relative flex h-44 items-end justify-center rounded bg-[radial-gradient(circle_at_50%_24%,rgba(255,255,255,0.18),rgba(255,255,255,0)_46%)]">
                <BobbleheadImage
                  src={imageSrc}
                  alt={`${team.city} ${team.name} ${title} bobblehead`}
                  width={268}
                  height={630}
                  eager
                  unoptimized={imageSrc.startsWith("http")}
                  className="relative h-40 w-auto object-contain drop-shadow-[0_12px_16px_rgba(0,0,0,0.65)]"
                />
              </div>
              <div className="mt-2 rounded bg-black/45 px-2 py-1 text-sm font-black uppercase tracking-wide text-zinc-100">
                {team.name}
              </div>
            </div>
          </aside>

          <div className="grid gap-6 xl:grid-cols-[1fr_210px]">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.22em] text-accent">
                {team.city} {team.name}
              </p>
              <h1 className="mt-3 flex flex-wrap items-center gap-3 text-4xl font-black uppercase leading-none tracking-wide text-white sm:text-5xl 2xl:text-6xl">
                <span>
                  <BobbleheadTitle title={title} nickname={nickname} />
                </span>
                <WantedButton
                  isWanted={isWanted}
                  isLoggedIn={isLoggedInForWanted}
                  onToggle={() => setWanted(giveaway.id, !isWanted)}
                  className="h-9 w-9 text-xl sm:h-10 sm:w-10 sm:text-2xl"
                />
                <FavoriteButton
                  isFavorited={isFavorited}
                  isLoggedIn={isLoggedInForFavorites}
                  onToggle={() => setFavorited(giveaway.id, !isFavorited)}
                  className="h-9 w-9 text-xl sm:h-10 sm:w-10 sm:text-2xl"
                />
              </h1>
              <dl className="mt-6 grid max-w-4xl gap-x-8 gap-y-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                {details.map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="text-xs font-black uppercase tracking-wide text-zinc-400">{label}</dt>
                    <dd className="mt-1 truncate text-base font-semibold text-zinc-100">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex flex-col items-start gap-4 xl:items-end">
              {isAdmin ? (
                <button
                  type="button"
                  onClick={() => setIsEditOpen(true)}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-5 py-3 text-sm font-bold uppercase tracking-wide text-zinc-100 transition hover:border-accent hover:text-accent-hover"
                >
                  <span>✎</span>
                  Edit bobblehead
                </button>
              ) : null}
              <p className="text-sm leading-6 text-zinc-300 xl:text-right">
                {isLoggedIn ? "Log ownership and photos for this bobblehead." : "Log in to track this bobblehead in your collection."}
              </p>
            </div>
          </div>
          </div>
        </section>

        <section className="m-2 rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-[#0b1a29] sm:m-3 sm:p-6">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-black/10 pb-3 dark:border-white/15">
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-zinc-900 dark:text-white">Photos</p>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Have a better photo? Submit it for the admin to review.
              </p>
            </div>
          </div>
          {galleryPhotosToShow.length > 0 ? (
            <div className="mb-5">
              <PhotoGallery
                photos={galleryPhotosToShow}
                onDelete={isAdmin ? handleDeleteGalleryPhoto : undefined}
                onSetAsMain={isAdmin ? handleSetGalleryPhotoAsMain : undefined}
              />
            </div>
          ) : null}
          <div className="space-y-5">
            {!isOwned ? (
              <div className="rounded-lg border border-accent/50 bg-accent/10 p-4">
                <p className="text-sm font-black uppercase tracking-wide text-accent">
                  Mark this one as owned
                </p>
                <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  {isLoggedIn
                    ? "Track this bobblehead in your own collection."
                    : "Log in to track this bobblehead in your own collection."}
                </p>
              </div>
            ) : null}

            <SubmitPhotoButton
              bobbleheadId={giveaway.id}
              teamSlug={team.slug}
              label="Add photos"
              className="flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-400/70 px-5 py-5 text-zinc-800 transition hover:border-accent hover:text-accent-hover dark:text-zinc-200 dark:hover:text-accent-hover"
            >
              <span className="text-3xl">▣</span>
              <span className="mt-1 text-lg font-black uppercase tracking-wide">Submit a photo</span>
              <span className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">Reviewed by the admin before it goes live</span>
            </SubmitPhotoButton>

            <button
              type="button"
              aria-pressed={isOwned}
              disabled={!isLoggedIn}
              className={`w-full rounded-lg px-5 py-4 text-base font-black uppercase tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition disabled:cursor-not-allowed disabled:opacity-50 ${
                isOwned
                  ? "bg-green-500 text-[#06110a] hover:bg-green-400"
                  : "border border-accent text-accent hover:bg-accent-hover hover:text-accent-fg"
              }`}
              onClick={() => setOwned(giveaway.id, !isOwned)}
            >
              {isOwned ? "✓ Owned" : isLoggedIn ? "Mark as owned" : "Log in to track"}
            </button>

            <ReportListingButton
              teamSlug={team.slug}
              bobbleheadId={giveaway.id}
              source="curated"
              title={title}
              className="mx-auto block text-center text-xs font-bold uppercase tracking-wide text-zinc-500 transition hover:text-accent-hover dark:hover:text-accent-hover"
            />
          </div>
        </section>
      </div>

      {isEditOpen ? (
        <EditBobbleheadDialog
          onClose={() => setIsEditOpen(false)}
          initial={{ title, nickname: nickname ?? "", year, date }}
          onSave={handleEditSave}
          onDelete={handleDelete}
          onRemovePhoto={removableMainPhotoUrl ? handleRemoveMainPhoto : undefined}
        />
      ) : null}
    </main>
  );
}
