import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import OrganizationGuard from '@/features/orgs/layout/OrganizationLayout/OrganizationGuard';
import ProjectLayoutContent, {
  type ProjectLayoutContentProps,
} from '@/features/orgs/layout/ProjectLayout/ProjectLayoutContent';

export type ProjectLayoutProps = ProjectLayoutContentProps;

export default function ProjectLayout({
  children,
  mainContainerProps,
  ...authenticatedLayoutProps
}: ProjectLayoutProps) {
  return (
    <AuthenticatedLayout {...authenticatedLayoutProps} withMainNav={false}>
      <OrganizationGuard>
        <ProjectLayoutContent mainContainerProps={mainContainerProps}>
          {children}
        </ProjectLayoutContent>
      </OrganizationGuard>
    </AuthenticatedLayout>
  );
}
