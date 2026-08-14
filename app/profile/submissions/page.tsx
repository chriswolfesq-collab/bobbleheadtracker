import type { Metadata } from "next";
import { SubmissionsTab } from "../tabs";

export const metadata: Metadata = {
  title: "My Submissions — BobbleShelf",
};

export default function ProfileSubmissionsPage() {
  return <SubmissionsTab />;
}
