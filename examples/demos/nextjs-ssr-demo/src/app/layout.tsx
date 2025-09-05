import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navigation from "./components/Navigation";
import { AuthProvider } from "./lib/nhost/AuthProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Nhost Next.js Demo",
  description: "Next.js demo for Nhost SDK",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AuthProvider>
          <div className="flex-col min-h-screen">
            <Navigation />
            <main className="max-w-2xl mx-auto p-6 w-full">{children}</main>
            <footer>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                © {new Date().getFullYear()} Nhost Demo
              </p>
            </footer>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
