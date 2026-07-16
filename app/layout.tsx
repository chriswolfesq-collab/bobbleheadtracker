import type { Metadata } from "next";
import { AuthModal } from "@/components/AuthModal";
import { BackToTopButton } from "@/components/BackToTopButton";
import { RequireDisplayNameGate } from "@/components/RequireDisplayNameGate";
import { ToastProvider } from "@/components/Toast";
import { AdminAuthProvider } from "@/lib/adminAuth";
import { AuthProvider } from "@/lib/auth";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://bobbleshelf.com"),
  title: "MLB Bobblehead Collection",
  description: "Every SGA bobblehead, every team. Track your collection.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <AdminAuthProvider>
            <ToastProvider>
              <RequireDisplayNameGate>{children}</RequireDisplayNameGate>
            </ToastProvider>
          </AdminAuthProvider>
          <AuthModal />
        </AuthProvider>
        <BackToTopButton />
      </body>
    </html>
  );
}
