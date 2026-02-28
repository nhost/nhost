import type { Metadata } from 'next';
import './globals.css';
import Navigation from '../components/Navigation';

export const metadata: Metadata = {
  title: 'Nhost Next.js Tutorial',
  description: 'Next.js tutorial with Nhost authentication',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Navigation />
        <div className="app-content">{children}</div>
      </body>
    </html>
  );
}
