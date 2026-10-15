import { createFileRoute } from '@tanstack/react-router';
import { Archive } from 'lucide-react';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/storage/buckets/',
)({
  component: StorageIndexPage,
});

function StorageIndexPage() {
  return (
    <div className="grid w-full place-content-center gap-2 px-4 py-16 text-center">
      <div className="mx-auto">
        <Archive className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="!leading-6 font-medium text-[1.125rem]">Storage</h1>
      <p className="text-muted-foreground">
        Select a bucket from the sidebar to browse its files
      </p>
    </div>
  );
}
