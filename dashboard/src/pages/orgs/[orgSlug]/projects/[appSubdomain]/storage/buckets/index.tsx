import { HardDriveIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { AppLayout } from '@/components/layout/AppLayout';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { StorageLayout } from '@/features/orgs/projects/storage/components/StorageLayout';
import { StorageArea } from '@/features/orgs/projects/storage/layout';

export default function StorageIndexPage() {
  return (
    <EmptyState
      icon={HardDriveIcon}
      title="Storage"
      description="Select a bucket from the sidebar to browse its files"
    />
  );
}

StorageIndexPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <StorageArea>
          <div className="flex h-full">
            <StorageLayout>{page}</StorageLayout>
          </div>
        </StorageArea>
      </ProjectScope>
    </AppLayout>
  );
};
