import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { AuthModal } from "@/components/AuthModal";
import { BackToTopButton } from "@/components/BackToTopButton";
import { RepWelcomeBanner } from "@/components/RepWelcomeBanner";
import { RequireDisplayNameGate } from "@/components/RequireDisplayNameGate";
import { ToastProvider } from "@/components/Toast";
import { AdminAuthProvider } from "@/lib/adminAuth";
import { AuthProvider } from "@/lib/auth";
import { siteUrl } from "@/lib/siteUrl";
import { ThemeProvider } from "@/lib/theme";
import "./globals.css";

// Runs synchronously in <head> before first paint so the correct theme class is
// on <html> before any pixels render — otherwise a saved/forced dark theme would
// flash the light default (or vice-versa) on every load. Kept as a raw string in
// sync with lib/theme.tsx (THEME_STORAGE_KEY / THEME_DARK_CLASS).
const noFlashThemeScript = `(function(){try{var p=localStorage.getItem("bobbleshelf-theme");var d=p==="dark"||((p==="system"||!p)&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "MLB Bobblehead Collection",
  description: "Every SGA bobblehead, every team. Track your collection.",
};

// themeColor drives the mobile browser chrome; the two values mirror the
// light/dark backgrounds so the address bar matches the no-flash theme set in
// <head> above rather than snapping from one to the other on load.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
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
                <RepWelcomeBanner />
              </ToastProvider>
            </AdminAuthProvider>
            <AuthModal />
          </AuthProvider>
          <BackToTopButton />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
