import {
  AuthenticatedLayout,
  type AuthenticatedLayoutProps,
} from '@/components/layout/AuthenticatedLayout';
import OrganizationGuard from '@/features/orgs/layout/OrganizationLayout/OrganizationGuard';
import OrganizationLayoutFrame from '@/features/orgs/layout/OrganizationLayout/OrganizationLayoutFrame';

export type OrganizationLayoutProps = AuthenticatedLayoutProps;

export default function OrganizationLayout({
  children,
  ...authenticatedLayoutProps
}: OrganizationLayoutProps) {
  return (
    <AuthenticatedLayout {...authenticatedLayoutProps} withMainNav={false}>
      <OrganizationGuard>
        <OrganizationLayoutFrame>{children}</OrganizationLayoutFrame>
      </OrganizationGuard>
    </AuthenticatedLayout>
  );
}
