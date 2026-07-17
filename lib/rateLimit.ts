import type { PostgrestError } from "@supabase/supabase-js";

// SQLSTATE raised by the rate-limit triggers in supabase/rate_limit.sql.
export const RATE_LIMIT_SQLSTATE = "BB429";

const FRIENDLY_MESSAGE = "You're doing that too often. Please wait a little while and try again.";

// Turns a Supabase insert error into the Error to throw. A rate-limit rejection
// (raised by the DB triggers) gets one consistent friendly message regardless
// of the raw SQL text; every other error passes through unchanged.
export function submissionError(error: PostgrestError): Error {
  if (error.code === RATE_LIMIT_SQLSTATE) {
    return new Error(FRIENDLY_MESSAGE);
  }
  return new Error(error.message);
}
