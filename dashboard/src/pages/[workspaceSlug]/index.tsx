import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useNotFoundRedirect } from '@/features/projects/common/hooks/useNotFoundRedirect';
import { WorkspaceApps } from '@/features/projects/workspaces/components/WorkspaceApps';
import { WorkspaceHeader } from '@/features/projects/workspaces/components/WorkspaceHeader';
import { WorkspaceInvoices } from '@/features/projects/workspaces/components/WorkspaceInvoices';
import { WorkspaceMembers } from '@/features/projects/workspaces/components/WorkspaceMembers';
import { WorkspacePaymentMethods } from '@/features/projects/workspaces/components/WorkspacePaymentMethods';
import { NextSeo } from 'next-seo';
import type { ReactElement } from 'react';

export default function WorkspaceDetailsPage() {
  const { currentWorkspace, loading } = useCurrentWorkspaceAndProject();

  useNotFoundRedirect();

  if (!currentWorkspace || loading) {
    return <LoadingScreen />;
  }

  return (
    <Container className="pt-14">
      <WorkspaceHeader />
      <WorkspaceApps />
      <WorkspacePaymentMethods />
      <WorkspaceInvoices />
      <WorkspaceMembers />
      <NextSeo title={currentWorkspace.name} />
    </Container>
  );
}

WorkspaceDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
