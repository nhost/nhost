import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { Bucket } from '@/features/orgs/projects/storage/components/Bucket';
import { StorageLayout } from '@/features/orgs/projects/storage/components/StorageLayout';
import { StorageArea } from '@/features/orgs/projects/storage/layout';

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
        <StorageArea>
          <ContentPanel>
            <div className="flex h-full">
              <StorageLayout>{page}</StorageLayout>
            </div>
          </ContentPanel>
        </StorageArea>
      </ProjectScope>
    </AppLayout>
  );
};
