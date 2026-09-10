import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectViewWithState } from '@/features/orgs/layout/ProjectGuard';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
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
        <ProjectViewWithState>
          <div className="flex h-full">
            <StorageLayout>{page}</StorageLayout>
          </div>
        </ProjectViewWithState>
      </ProjectScope>
    </AppLayout>
  );
};
