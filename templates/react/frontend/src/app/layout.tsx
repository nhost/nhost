import type { ReactNode } from 'react';
import AuthErrorFromUrl from '@/components/AuthErrorFromUrl';
import Footer from '@/components/Footer';
import Nav from '@/components/Nav';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <AuthErrorFromUrl />
        {children}
      </main>
      <Footer />
    </div>
  );
}
