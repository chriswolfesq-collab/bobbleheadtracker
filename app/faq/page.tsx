import type { Metadata } from "next";
import { BreadcrumbJsonLd } from "@/components/BreadcrumbJsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";

export const metadata: Metadata = {
  title: "FAQ — BobbleShelf",
  description: "Frequently asked questions about BobbleShelf and tracking your MLB bobblehead collection.",
  alternates: { canonical: "/faq" },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "What counts as an SGA bobblehead?",
    a: "MLB stadium giveaway bobbleheads only — the ones handed out at the ballpark. No figurines, ring or trophy replicas, stadium replicas, gnomes, or other non-bobblehead promos.",
  },
  {
    q: "How do I track my collection?",
    a: "Create a free account, then hit \"I Own It\" on any bobblehead. Your team pages show owned/needed counts and a completion percentage, and your profile collects everything in one place.",
  },
  {
    q: "A bobblehead is missing — can I add it?",
    a: "Yes. Every team page has a \"Submit a bobblehead\" button. Submissions are reviewed before they appear for everyone.",
  },
  {
    q: "A listing has wrong info. How do I fix it?",
    a: "Use \"Submit an Update\" at the bottom of the bobblehead's page and tell us what's off. The admin reviews every report.",
  },
  {
    q: "Can I share my collection?",
    a: "Yes — turn on shelf sharing in Settings to get a public link to your shelf, complete with a shareable image.",
  },
  {
    q: "Where does the \"rarity\" badge come from?",
    a: "It's derived from the quantity issued: under 10,000 is Ultra Rare, under 15,000 is Rare, and under 25,000 is Limited. Common runs (25,000+) get no badge.",
  },
];

export default function FaqPage() {
  return (
    <div className="flex min-h-full flex-1 flex-col" style={{ background: "var(--page-gradient)" }}>
      <BreadcrumbJsonLd trail={[{ name: "FAQ", path: "/faq" }]} />
      <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
        <Breadcrumbs className="mb-6" items={[{ href: "/", label: "Home" }, { label: "FAQ" }]} />
        <h1 className="font-display text-4xl font-bold uppercase tracking-wide text-navy">FAQ</h1>
        <div className="mt-6 space-y-4">
          {FAQS.map((faq) => (
            <div key={faq.q} className="rounded-xl border border-border-soft bg-surface p-5">
              <h2 className="text-base font-bold text-navy">{faq.q}</h2>
              <p className="mt-2 text-sm leading-6 text-zinc-700">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
