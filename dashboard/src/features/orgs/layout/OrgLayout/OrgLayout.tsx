import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import OrganizationGuard from './OrganizationGuard';
import ProjectLayoutContent, {
  type ProjectLayoutContentProps,
} from './ProjectLayoutContent';

interface OrgLayoutProps extends ProjectLayoutContentProps {
  isOrgPage?: boolean;
}

export default function OrgLayout({
  children,
  mainContainerProps,
  isOrgPage,
}: OrgLayoutProps) {
  return (
    <AuthenticatedLayout>
      <OrganizationGuard>
        {isOrgPage ? (
          children
        ) : (
          <ProjectLayoutContent mainContainerProps={mainContainerProps}>
            {children}
          </ProjectLayoutContent>
        )}
      </OrganizationGuard>
    </AuthenticatedLayout>
  );
}
