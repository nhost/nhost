import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/app/globals.css';
import { Providers } from '@/app/providers';
import Nav from '@/components/Nav';
import { applyStoredTheme } from '@/lib/theme';

export const metadata: Metadata = {
  title: 'Nhost + Next.js + shadcn/ui',
  description: 'A full-stack starter powered by Nhost, Next.js and shadcn/ui',
};

/**
 * `modal` is a parallel route slot. It renders alongside the page rather than
 * in place of it, which is what lets an intercepted route sit over whatever
 * you were already reading. On every other route it renders `@modal/default`,
 * which is nothing.
 */
export default function RootLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  return (
    // The theme script writes to <html> before React hydrates, which is a
    // difference the server could not have predicted.
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed string, no input reaches it */}
        <script dangerouslySetInnerHTML={{ __html: applyStoredTheme }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>
          <Nav />
          <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
          {modal}
        </Providers>
      </body>
    </html>
  );
}
