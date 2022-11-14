import { LoadingScreen } from '@/components/common/LoadingScreen';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Container from '@/components/layout/Container';
import {
  WorkspaceApps,
  WorkspaceHeader,
  WorkspaceMembers,
} from '@/components/workspace';
import { WorkspaceInvoices } from '@/components/workspace/WorkspaceInvoices';
import WorkspacePaymentMethods from '@/components/workspace/WorkspacePaymentMethods';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useGetAllUserWorkspacesAndApplications } from '@/hooks/useGetAllUserWorkspacesAndApplications';
import useNotFoundRedirect from '@/hooks/useNotFoundRedirect';
import { NextSeo } from 'next-seo';
import type { ReactElement } from 'react';

export default function WorkspaceDetailsPage() {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();

  useGetAllUserWorkspacesAndApplications(false);
  useNotFoundRedirect();

  if (!currentWorkspace) {
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
  return <AuthenticatedLayout>{page}</AuthenticatedLayout>;
};
