import CenteredLayout from '@/components/CenteredLayout';

/** What any path without a page shows, as Next's default not-found page. */
export default function NotFound() {
  return (
    <CenteredLayout>
      <div className="flex items-center justify-center gap-4">
        <h1 className="border-r pr-4 font-medium text-2xl">404</h1>
        <p className="text-sm">This page could not be found.</p>
      </div>
    </CenteredLayout>
  );
}
