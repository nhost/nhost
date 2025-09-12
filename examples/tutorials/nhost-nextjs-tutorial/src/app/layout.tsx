import type { Metadata } from "next";
import "./globals.css";
import Navigation from "../components/Navigation";
import { AuthProvider } from "../lib/nhost/AuthProvider";

export const metadata: Metadata = {
  title: "Nhost Next.js Tutorial",
  description: "Next.js tutorial with Nhost authentication",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <Navigation />
          <div className="app-content">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
