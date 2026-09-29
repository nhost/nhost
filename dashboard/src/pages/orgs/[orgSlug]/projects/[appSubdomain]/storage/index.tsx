import { Archive } from 'lucide-react';
import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { StorageLayout } from '@/features/orgs/projects/storage/components/StorageLayout';

export default function StorageIndexPage() {
  return (
    <div className="grid w-full place-content-center gap-2 px-4 py-16 text-center">
      <div className="mx-auto">
        <Archive className="h-12 w-12 text-muted-foreground" />
      </div>
      <h1 className="!leading-6 font-inter-var font-medium text-[1.125rem]">
        Storage
      </h1>
      <p className="text-muted-foreground">
        Select a bucket from the sidebar to browse its files
      </p>
    </div>
  );
}

StorageIndexPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <ProjectStateGate>
          <div className="flex h-full">
            <StorageLayout>{page}</StorageLayout>
          </div>
        </ProjectStateGate>
      </ProjectScope>
    </AppLayout>
  );
};
