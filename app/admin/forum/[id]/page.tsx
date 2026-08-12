import { ForumTopicClient } from "./ForumTopicClient";

// Server shell only, to unwrap the params promise — the thread itself is client
// rendered, like the rest of the admin console, because every read is an RPC
// made with the signed-in moderator's own session.
//
// No generateMetadata and no caching directives: /admin is disallowed in
// app/robots.ts and nothing here should ever be prerendered.
export default async function ForumTopicPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ForumTopicClient topicId={id} />;
}
