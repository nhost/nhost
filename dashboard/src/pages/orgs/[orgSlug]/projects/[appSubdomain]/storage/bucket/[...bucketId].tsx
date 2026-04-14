import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
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
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <StorageLayout>{page}</StorageLayout>
    </OrgLayout>
  );
};
