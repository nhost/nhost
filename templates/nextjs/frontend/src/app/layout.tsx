import type { Metadata } from 'next';
import { type ReactNode, Suspense } from 'react';
import '@/app/globals.css';
import AuthErrorFromUrl from '@/components/AuthErrorFromUrl';
import Footer from '@/components/Footer';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Nhost + Next.js',
  description: 'An auth starter powered by Nhost and Next.js',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // The app is dark only, so the class is fixed rather than toggled.
  // globals.css explains what still reads it.
  return (
    <html lang="en" className="dark">
      <body className="flex min-h-screen flex-col antialiased">
        <Nav />
        <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
          {/* Every page renders per request today, but on one Next prerenders,
              reading the query outside a boundary fails the build. */}
          <Suspense>
            <AuthErrorFromUrl />
          </Suspense>
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
