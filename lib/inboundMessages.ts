import { RATE_LIMIT_SQLSTATE } from "@/lib/rateLimit";
import { supabase } from "@/lib/supabase";

// Writes to public.inbound_messages (see supabase/inbound_messages.sql), which
// backs both the /contact form and the "Become a team rep" application. Insert
// only — the table is write-for-anyone, read-for-admins, so there's nothing to
// read back here.
//
// Signing in is not required for either form: the whole point of the contact
// form is to be reachable by someone who can't get into their account.

export type InboundMessageKind = "contact" | "rep_application";

export type InboundMessageInput = {
  kind: InboundMessageKind;
  name: string;
  email: string;
  message: string;
  /** Required for a rep application, and must be absent for a contact message. */
  teamSlug?: string | null;
};

/** Mirrors the length and shape checks in the table's insert policy, so the form
 *  can say what's wrong instead of surfacing a policy violation. */
export function validateInboundMessage(input: InboundMessageInput): string | null {
  const email = input.email.trim();
  const message = input.message.trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 200) {
    return "Enter an email address we can reply to.";
  }
  if (message.length < 10) {
    return "Tell us a little more — at least a sentence.";
  }
  if (message.length > 4000) {
    return "That's a bit long. Please keep it under 4,000 characters.";
  }
  if (input.name.trim().length > 120) {
    return "That name is too long.";
  }
  if (input.kind === "rep_application" && !input.teamSlug) {
    return "Pick the team you'd like to represent.";
  }
  return null;
}

export async function sendInboundMessage(input: InboundMessageInput): Promise<void> {
  const validationError = validateInboundMessage(input);
  if (validationError) throw new Error(validationError);

  const name = input.name.trim();
  // submitted_by is context for the admin, not identity: the insert policy only
  // allows it to be the caller's own id or null.
  const { data: auth } = await supabase.auth.getUser();

  const { error } = await supabase.from("inbound_messages").insert({
    kind: input.kind,
    name: name || null,
    email: input.email.trim(),
    message: input.message.trim(),
    team_slug: input.kind === "rep_application" ? (input.teamSlug ?? null) : null,
    submitted_by: auth?.user?.id ?? null,
  });

  if (!error) return;

  // The rate-limit trigger's own message is already written for a reader, so it
  // passes through. Everything else — an RLS refusal, a policy violation, a
  // missing table before the migration is run — is a developer-facing string,
  // and this form is on a public page. Log the real one, show generic copy.
  if (error.code === RATE_LIMIT_SQLSTATE) {
    throw new Error("You've sent a few messages already. Please wait a bit and try again.");
  }

  console.error("Failed to send message:", error.message);
  throw new Error("Couldn't send that right now. Please try again in a moment.");
}
