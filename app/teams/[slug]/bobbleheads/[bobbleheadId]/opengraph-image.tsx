import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { getGiveawayById } from "@/lib/bobbleheads";
import { getCuratedListingData } from "@/lib/curatedListing";
import { fitWithin, imageDimensions } from "@/lib/imageDimensions";
import { legibleAccent } from "@/lib/ogAccent";
import { getRarity } from "@/lib/rarity";
import { getTeamBySlug } from "@/lib/teams";

export const alt = "A stadium giveaway bobblehead on Bobble Shelf";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Rendered on demand, then cached — not baked at build and not re-rendered per
// request. There are ~3,600 of these listings, so inheriting the sibling page's
// generateStaticParams would add thousands of Satori renders to every deploy;
// returning no params opts out of that while leaving dynamicParams on, so an
// unknown card renders the first time it's asked for and is served from the
// cache after. It was force-dynamic before, which meant every crawler and every
// link unfurl paid for a fresh Satori render plus a remote photo fetch.
//
// Safe to cache indefinitely because the overrides and approved photo it reads
// go through CURATED_DATA_TAG, which the revalidate route busts on an admin
// edit (app/api/revalidate).
export function generateStaticParams() {
  return [];
}

// Fits on two lines at 58px Geist Black inside the card's text column.
const MAX_TITLE_CHARS = 44;
// How long to wait on a remote listing photo before giving up and falling back
// to the team figure. A link preview that renders late is worse than one that
// renders without the photo — crawlers don't wait around.
const REMOTE_PHOTO_TIMEOUT_MS = 2500;

/** The photo envelope: the box the picture is fitted inside, at its own ratio. */
const PHOTO_MAX_WIDTH = 460;
const PHOTO_MAX_HEIGHT = 534;

type LoadedPhoto = { src: string; width: number; height: number };

/**
 * The listing photo as a data URI, sized to its own aspect ratio. Satori can't
 * use next/image and won't read from disk, so local assets are inlined and
 * remote ones are fetched here rather than left for Satori to resolve — a host
 * that hangs or 403s would otherwise take the whole card down instead of just
 * the photo. Satori also needs explicit dimensions on every <img>, so the shape
 * is read out of the header bytes we already have in hand.
 */
async function loadPhoto(url: string): Promise<LoadedPhoto | null> {
  try {
    let buffer: Buffer;
    let type: string;

    if (/^https?:\/\//.test(url)) {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REMOTE_PHOTO_TIMEOUT_MS),
      });
      if (!response.ok) return null;
      type = response.headers.get("content-type") ?? "image/jpeg";
      if (!type.startsWith("image/")) return null;
      buffer = Buffer.from(await response.arrayBuffer());
    } else {
      // A site-relative path like "/bobbleheads/angels-photos/foo.jpg".
      const clean = url.split("?")[0];
      buffer = await readFile(join(process.cwd(), "public", clean));
      const ext = clean.slice(clean.lastIndexOf(".") + 1).toLowerCase();
      type = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    }

    const natural = imageDimensions(buffer);
    // An unreadable header just means we fall back to the full envelope and let
    // objectFit sort it out, rather than dropping an otherwise fine photo.
    const box = natural
      ? fitWithin(natural, PHOTO_MAX_WIDTH, PHOTO_MAX_HEIGHT, 1.6)
      : { width: PHOTO_MAX_WIDTH, height: PHOTO_MAX_HEIGHT };

    return {
      src: `data:${type};base64,${buffer.toString("base64")}`,
      ...box,
    };
  } catch {
    return null;
  }
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string; bobbleheadId: string }>;
}) {
  const { slug, bobbleheadId } = await params;
  const team = getTeamBySlug(slug);
  const giveaway = getGiveawayById(bobbleheadId, slug);

  // Matches the page's notFound for an unknown slug or id: no image rather than
  // a broken card.
  if (!team || !giveaway) return new Response("Not found", { status: 404 });

  const { override, imageUrl } = await getCuratedListingData(slug, bobbleheadId);
  // A deleted listing 404s on the page, so its card shouldn't exist either.
  if (override?.deleted) return new Response("Not found", { status: 404 });

  const title = override?.title ?? giveaway.title;
  const nickname = override?.nickname ?? giveaway.nickname ?? null;
  const year = override?.year ?? giveaway.year;
  const date = override?.date ?? giveaway.date;
  const quantity = override?.quantity ?? giveaway.quantity ?? null;
  const rarity = getRarity(quantity);

  // Same two layers the page resolves, in the same order: the approved photo
  // sits on top of the curated seed image, which photo_hidden suppresses.
  const seedPhoto = override?.photoHidden ? null : (giveaway.imageUrl ?? null);
  const listingPhoto = imageUrl ?? seedPhoto;

  // Fall back to the team's pre-baked 200x480 figure, the same one the team and
  // shelf cards use, so a listing with no photo yet still gets a real card.
  const photo =
    (listingPhoto ? await loadPhoto(listingPhoto) : null) ??
    (await loadPhoto(`/bobbleheads/og/${slug}.png`));

  const clipped =
    title.length > MAX_TITLE_CHARS
      ? `${title.slice(0, MAX_TITLE_CHARS - 1).trimEnd()}…`
      : title;
  // Long names get a smaller face so they still fit two lines.
  const titleSize = clipped.length > 30 ? 50 : clipped.length > 20 ? 58 : 66;

  // Satori ships no system fonts and won't synthesize weights, so the heavy type
  // this design needs has to be handed in explicitly.
  const [black, regular] = await Promise.all([
    readFile(join(process.cwd(), "assets/Geist-Black.ttf")),
    readFile(join(process.cwd(), "assets/Geist-Regular.ttf")),
  ]);

  const accent = legibleAccent(team.primary);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          // Linear rather than the site's radial gradient: Satori's radial
          // support is patchy and the difference is invisible at this size.
          backgroundImage: "linear-gradient(160deg, #1b2a4a 0%, #0e1626 45%, #090e1a 100%)",
          fontFamily: "Geist",
          padding: "48px 56px",
        }}
      >
        {/* The photo is the hook — this is the one card where the subject has a
            real picture, so it leads rather than sitting under the type. */}
        <div
          style={{
            display: "flex",
            width: PHOTO_MAX_WIDTH,
            height: PHOTO_MAX_HEIGHT,
            flexShrink: 0,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {photo ? (
            <img
              src={photo.src}
              alt=""
              width={photo.width}
              height={photo.height}
              style={{ objectFit: "contain", objectPosition: "center" }}
            />
          ) : null}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            height: "100%",
            paddingLeft: 48,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: "0.22em",
              color: accent,
            }}
          >
            {`${team.city} ${team.name}`.toUpperCase()}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 14,
              fontSize: titleSize,
              fontWeight: 900,
              lineHeight: 1.05,
              color: "white",
            }}
          >
            {clipped}
          </div>

          {nickname ? (
            <div
              style={{
                display: "flex",
                marginTop: 10,
                fontSize: 30,
                fontWeight: 400,
                color: "#d4d4d8",
              }}
            >
              {nickname}
            </div>
          ) : null}

          {/* The year carries the weight here the count does on the other cards:
              it's the thing a collector scans for. */}
          <div style={{ display: "flex", alignItems: "baseline", gap: 16, marginTop: 22 }}>
            <div
              style={{ display: "flex", fontSize: 92, fontWeight: 900, lineHeight: 1, color: "#fbbf24" }}
            >
              {year}
            </div>
            <div style={{ display: "flex", fontSize: 26, fontWeight: 900, letterSpacing: "0.14em", color: "#e4e4e7" }}>
              GIVEAWAY
            </div>
          </div>

          {date && date !== "N/A" ? (
            <div style={{ display: "flex", marginTop: 12, fontSize: 24, fontWeight: 400, color: "#a1a1aa" }}>
              {date}
            </div>
          ) : null}

          {/* Scarcity is the other half of why a collector clicks. Only shown
              when the quantity actually earns a badge. */}
          {rarity ? (
            <div style={{ display: "flex", marginTop: 22 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 22,
                  fontWeight: 900,
                  letterSpacing: "0.12em",
                  color: "#0e1626",
                  backgroundColor: "#fbbf24",
                  borderRadius: 8,
                  padding: "8px 16px",
                }}
              >
                {rarity.label.toUpperCase()}
                {quantity?.trim() ? ` · ${quantity} ISSUED` : ""}
              </div>
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              marginTop: "auto",
              fontSize: 20,
              fontWeight: 900,
              letterSpacing: "0.2em",
              color: "#71717a",
            }}
          >
            BOBBLESHELF.COM
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: black, weight: 900, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
