import type { Metadata } from "next";
import { AuthModal } from "@/components/AuthModal";
import { BackToTopButton } from "@/components/BackToTopButton";
import { RequireDisplayNameGate } from "@/components/RequireDisplayNameGate";
import { ToastProvider } from "@/components/Toast";
import { AdminAuthProvider } from "@/lib/adminAuth";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

// Runs synchronously in <head> before first paint so the correct theme class is
// on <html> before any pixels render — otherwise a saved/forced dark theme would
// flash the light default (or vice-versa) on every load. Kept as a raw string in
// sync with lib/theme.tsx (THEME_STORAGE_KEY / THEME_DARK_CLASS).
const noFlashThemeScript = `(function(){try{var p=localStorage.getItem("bobbleshelf-theme");var d=p==="dark"||((p==="system"||!p)&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

// Resolves the relative og:image from /shelf/<slug> into an absolute URL, which
// crawlers require. It has to follow the deployment: pinned to bobbleshelf.com,
// a preview build would advertise an image URL on the production domain — a
// different site, without that shelf — so previews would always unfurl broken
// and there'd be no way to check a share card before shipping it.
// VERCEL_URL is the per-deployment host and is unset locally.
function siteUrl(): string {
  if (process.env.VERCEL_ENV === "production") return "https://bobbleshelf.com";
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "MLB Bobblehead Collection",
  description: "Every SGA bobblehead, every team. Track your collection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashThemeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <AdminAuthProvider>
              <ToastProvider>
                <RequireDisplayNameGate>{children}</RequireDisplayNameGate>
              </ToastProvider>
            </AdminAuthProvider>
            <AuthModal />
          </AuthProvider>
          <BackToTopButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
