import { ExternalLink, Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v3/button';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { ActionsBrowserSidebar } from '@/features/orgs/projects/actions/components/ActionsBrowserSidebar';
import { ActionsEmptyState } from '@/features/orgs/projects/actions/components/ActionsEmptyState';
import type { BaseActionFormTriggerProps } from '@/features/orgs/projects/actions/components/BaseActionForm';
import { CreateActionForm } from '@/features/orgs/projects/actions/components/CreateActionForm';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';

const renderNewActionCta = ({ open }: BaseActionFormTriggerProps) => (
  <Button className="gap-2" onClick={() => open()}>
    <Plus className="h-4 w-4" /> New Action
  </Button>
);

export default function ActionsPage() {
  const { data: actionsData, isLoading } = useGetActions();

  if (isLoading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading actions..."
        className="justify-center"
      />
    );
  }

  const hasActions = (actionsData?.actions.length ?? 0) > 0;

  if (!hasActions) {
    return (
      <ActionsEmptyState
        title="Create your first action"
        description="Actions let you extend your GraphQL API with custom business logic running behind an HTTP webhook handler."
      >
        <CreateActionForm trigger={renderNewActionCta} />
        <a
          href="https://docs.nhost.io/products/graphql"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Learn more about GraphQL
          <ExternalLink className="h-4 w-4" />
        </a>
      </ActionsEmptyState>
    );
  }

  return (
    <ActionsEmptyState
      title="Actions"
      description="Select an action from the sidebar, or create a new one."
    >
      <CreateActionForm trigger={renderNewActionCta} />
    </ActionsEmptyState>
  );
}

ActionsPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <ActionsBrowserSidebar />

      <Box
        className="flex w-full flex-auto flex-col overflow-x-hidden"
        sx={{ backgroundColor: 'background.default' }}
      >
        {page}
      </Box>
    </OrgLayout>
  );
};
