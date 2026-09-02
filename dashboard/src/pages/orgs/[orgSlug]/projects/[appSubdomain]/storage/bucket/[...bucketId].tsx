import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Bucket } from '@/features/orgs/projects/storage/components/Bucket';
import { StorageLayout } from '@/features/orgs/projects/storage/components/StorageLayout';
import { getStorageLayout } from '@/features/orgs/projects/storage/layout';

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
  return getStorageLayout(<StorageLayout>{page}</StorageLayout>, {
    contentClassName: 'flex w-full flex-auto overflow-hidden',
  });
};
