import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { AuthModal } from "@/components/AuthModal";
import { BackToTopButton } from "@/components/BackToTopButton";
import { RepWelcomeBanner } from "@/components/RepWelcomeBanner";
import { RequireDisplayNameGate } from "@/components/RequireDisplayNameGate";
import { SiteFooter, SiteHeader } from "@/components/SiteChrome";
import { ToastProvider } from "@/components/Toast";
import { AdminAuthProvider } from "@/lib/adminAuth";
import { AuthProvider } from "@/lib/auth";
import { siteUrl } from "@/lib/siteUrl";
import { inter, oswald, pacifico } from "./fonts";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: "BobbleShelf — MLB Bobblehead Collection",
  description: "Every SGA bobblehead, every team. Track your collection.",
};

// themeColor drives the mobile browser chrome; matches --background.
export const viewport: Viewport = {
  themeColor: "#f0e8dc",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${inter.variable} ${oswald.variable} ${pacifico.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AdminAuthProvider>
            <ToastProvider>
              <SiteHeader />
              <RequireDisplayNameGate>
                <main id="main-content" className="flex min-h-full flex-1 flex-col">
                  {children}
                </main>
              </RequireDisplayNameGate>
              <SiteFooter />
              <RepWelcomeBanner />
            </ToastProvider>
          </AdminAuthProvider>
          <AuthModal />
        </AuthProvider>
        <BackToTopButton />
        <Analytics />
      </body>
    </html>
  );
}
