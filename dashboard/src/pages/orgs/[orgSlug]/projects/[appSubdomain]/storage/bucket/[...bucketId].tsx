import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { Bucket } from '@/features/orgs/projects/storage/components/Bucket';
import { StorageLayout } from '@/features/orgs/projects/storage/components/StorageLayout';

export default function StoragePage() {
  return (
    <div className="h-full max-w-full pb-25 xs+:pb-[56.5px]">
      <RetryableErrorBoundary>
        <Bucket />
      </RetryableErrorBoundary>
    </div>
  );
}

StoragePage.getLayout = function getLayout(page: ReactElement) {
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
