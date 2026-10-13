import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { DatabaseExtensions } from '@/features/orgs/projects/database/extensions/components/DatabaseExtensions';

export default function DatabaseExtensionsPage() {
  return (
    <RetryableErrorBoundary>
      <DatabaseExtensions />
    </RetryableErrorBoundary>
  );
}

DatabaseExtensionsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout mainContainerProps={{ className: 'flex h-full' }}>
      <div className="box flex w-full flex-auto flex-col overflow-y-auto bg-default">
        {page}
      </div>
    </OrgLayout>
  );
};
