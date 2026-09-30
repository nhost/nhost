import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/app/globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'Nhost + Next.js + shadcn/ui',
  description: 'An auth starter powered by Nhost, Next.js and shadcn/ui',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Nav />
        <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
