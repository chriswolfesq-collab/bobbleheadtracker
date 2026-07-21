import { permanentRedirect } from "next/navigation";

// "/admin/giveaways" is a natural guess for the giveaways queue, but the real
// route is "/admin/scraped-giveaways". Alias the friendlier slug so a shared or
// bookmarked URL lands on the queue instead of the 404 page.
export default function AdminGiveawaysRedirect() {
  permanentRedirect("/admin/scraped-giveaways");
}
