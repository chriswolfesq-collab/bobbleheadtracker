import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Calls the admin-send-email Edge Function (supabase/functions/admin-send-email).
// functions.invoke automatically attaches the current admin session's access
// token, which the function re-checks with is_admin() before sending anything.

type SendArgs = {
  subject: string;
  body: string;
} & ({ all: true } | { recipientIds: string[] });

export async function sendAdminEmail(args: SendArgs): Promise<{ sent: number }> {
  const { data, error } = await supabaseAdmin.functions.invoke<{ sent: number; error?: string }>(
    "admin-send-email",
    { body: args },
  );

  if (error) {
    // FunctionsHttpError carries the function's own JSON error in the response.
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const parsed = await context.json();
        if (parsed?.error) message = parsed.error;
      } catch {
        // fall back to the generic message
      }
    }
    throw new Error(message);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return { sent: data?.sent ?? 0 };
}
