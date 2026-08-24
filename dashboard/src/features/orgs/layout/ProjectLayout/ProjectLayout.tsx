import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import OrganizationGuard from '@/features/orgs/layout/OrganizationLayout/OrganizationGuard';
import ProjectLayoutContent, {
  type ProjectLayoutContentProps,
} from '@/features/orgs/layout/ProjectLayout/ProjectLayoutContent';
import ProjectLayoutFrame from '@/features/orgs/layout/ProjectLayout/ProjectLayoutFrame';

export type ProjectLayoutProps = ProjectLayoutContentProps;

export default function ProjectLayout({
  children,
  mainContainerProps,
  ...authenticatedLayoutProps
}: ProjectLayoutProps) {
  return (
    <AuthenticatedLayout {...authenticatedLayoutProps}>
      <ProjectLayoutFrame>
        <OrganizationGuard>
          <ProjectLayoutContent mainContainerProps={mainContainerProps}>
            {children}
          </ProjectLayoutContent>
        </OrganizationGuard>
      </ProjectLayoutFrame>
    </AuthenticatedLayout>
  );
}
