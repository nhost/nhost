import {
  AuthenticatedLayout,
  type AuthenticatedLayoutProps,
} from '@/components/layout/AuthenticatedLayout';
import OrganizationGuard from '@/features/orgs/layout/OrganizationLayout/OrganizationGuard';

export type OrganizationLayoutProps = AuthenticatedLayoutProps;

export default function OrganizationLayout({
  children,
  ...authenticatedLayoutProps
}: OrganizationLayoutProps) {
  return (
    <AuthenticatedLayout {...authenticatedLayoutProps}>
      <OrganizationGuard>
        <main className="relative h-full min-w-0 flex-1 overflow-y-auto">
          {children}
        </main>
      </OrganizationGuard>
    </AuthenticatedLayout>
  );
}
