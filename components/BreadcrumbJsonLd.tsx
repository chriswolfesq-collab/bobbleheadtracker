import { siteUrl } from "@/lib/siteUrl";

/** A crumb as schema.org wants it: display name plus a site-relative path. */
export type JsonLdCrumb = { name: string; path: string };

/**
 * The schema.org BreadcrumbList for a page's visible <Breadcrumbs> trail, with
 * the site root prepended — every trail starts at the homepage, so no caller
 * spells it out. Crawlers need absolute URLs, which is why this lives on the
 * server component rather than inside the client Breadcrumbs component.
 *
 * Returned as a bare node so routes that already emit an @graph (a team page's
 * CollectionPage, a bobblehead's Product) can drop it in alongside; routes with
 * nothing but a trail should render <BreadcrumbJsonLd /> below instead.
 */
export function breadcrumbList(trail: JsonLdCrumb[]) {
  const base = siteUrl();

  return {
    "@type": "BreadcrumbList",
    itemListElement: [{ name: "BobbleShelf", path: "" }, ...trail].map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: `${base}${crumb.path}`,
    })),
  };
}

/** The standalone <script> form, for pages whose only structured data is the trail. */
export function BreadcrumbJsonLd({ trail }: { trail: JsonLdCrumb[] }) {
  const jsonLd = { "@context": "https://schema.org", ...breadcrumbList(trail) };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
