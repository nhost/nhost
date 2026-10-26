import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { DatabaseExtensions } from '@/features/orgs/projects/database/extensions/components/DatabaseExtensions';
import { DatabaseArea } from '@/features/orgs/projects/database/layout';

export default function DatabaseExtensionsPage() {
  return (
    <RetryableErrorBoundary>
      <DatabaseExtensions />
    </RetryableErrorBoundary>
  );
}

DatabaseExtensionsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout>
      <ProjectScope>
        <DatabaseArea>
          <div className="flex h-full">
            <div className="box flex w-full flex-auto flex-col overflow-y-auto">
              {page}
            </div>
          </div>
        </DatabaseArea>
      </ProjectScope>
    </AppLayout>
  );
};
