import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { OrgTabs } from '@/features/orgs/layout/OrgTabs';
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
          <div className="flex h-full flex-col">
            <OrgTabs />
            <div className="flex-1 overflow-auto">
              <div className="mx-auto w-full max-w-7xl">{children}</div>
            </div>
          </div>
        ) : (
          <ProjectLayoutContent mainContainerProps={mainContainerProps}>
            {children}
          </ProjectLayoutContent>
        )}
      </OrganizationGuard>
    </AuthenticatedLayout>
  );
}
