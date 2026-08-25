import {
  AuthenticatedLayout,
  type AuthenticatedLayoutProps,
} from '@/components/layout/AuthenticatedLayout';
import { Spinner } from '@/components/ui/v3/spinner';
import OrganizationGuard from '@/features/orgs/layout/OrganizationLayout/OrganizationGuard';

export type OrganizationLayoutProps = AuthenticatedLayoutProps;

export default function OrganizationLayout({
  children,
  ...authenticatedLayoutProps
}: OrganizationLayoutProps) {
  return (
    <AuthenticatedLayout {...authenticatedLayoutProps}>
      <main className="relative h-full min-w-0 flex-1 overflow-y-auto">
        <OrganizationGuard
          fallback={
            <div className="flex h-full w-full items-center justify-center">
              <Spinner size="medium" />
            </div>
          }
        >
          {children}
        </OrganizationGuard>
      </main>
    </AuthenticatedLayout>
  );
}
