import type { Metadata } from "next";
import { ResetPasswordPageClient } from "./ResetPasswordPageClient";

export const metadata: Metadata = {
  title: "Choose a new password — BobbleShelf",
  description: "Set a new password for your Bobble Shelf account.",
  // Nothing here is meaningful without a one-time recovery link, and an
  // indexed password form is only ever a phishing lookalike.
  robots: { index: false },
};

export default function ResetPasswordPage() {
  return <ResetPasswordPageClient />;
}
