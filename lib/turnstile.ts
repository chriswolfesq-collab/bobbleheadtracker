// Cloudflare Turnstile site key, and the single switch for whether CAPTCHA is
// wired into auth at all.
//
// The integration is deliberately dormant until BOTH halves are configured:
//
//  1. Supabase dashboard: Authentication > Attack Protection > Enable CAPTCHA
//     protection, provider Turnstile, with the Turnstile SECRET key. From that
//     moment Supabase rejects sign-up / password sign-in / password-reset calls
//     that don't carry a captchaToken.
//  2. Vercel (and .env.local): NEXT_PUBLIC_TURNSTILE_SITE_KEY set to the
//     Turnstile SITE key, so the widget renders and the token gets sent.
//
// With neither set, nothing changes: the widget renders nothing and the auth
// calls send no token. Enabling only the dashboard half would break sign-in
// for everyone (no token to send), so flip the env var first, deploy, then
// enable it in the dashboard.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

export const captchaEnabled = TURNSTILE_SITE_KEY.length > 0;
