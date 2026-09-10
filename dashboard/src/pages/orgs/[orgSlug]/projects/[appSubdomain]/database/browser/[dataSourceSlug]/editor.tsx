import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { SQLEditor } from '@/features/orgs/projects/database/dataGrid/components/SQLEditor';
import { getDatabaseLayout } from '@/features/orgs/projects/database/layout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function Editor() {
  const { project } = useProject();

  if (!project?.config?.hasura.adminSecret) {
    return <LoadingScreen />;
  }

  return <SQLEditor />;
}

Editor.getLayout = function getLayout(page: ReactElement) {
  return getDatabaseLayout(
    <RetryableErrorBoundary>{page}</RetryableErrorBoundary>,
    {
      contentClassName: 'box flex w-full flex-col overflow-x-hidden bg-default',
    },
  );
};
