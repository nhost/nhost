import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { ListNavLink } from '@/components/common/NavLink';
import { FeatureSidebar } from '@/components/layout/FeatureSidebar';
import {
  dashboardNavItemTextClassName,
} from '@/components/layout/DashboardSidebar/DashboardSidebar';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';

interface AINavLinkProps {
  children: ReactNode;
  href: string;
  exact?: boolean;
  onClick?: VoidFunction;
}

function AINavLink({ exact = true, href, children, onClick }: AINavLinkProps) {
  const router = useRouter();

  const {
    query: { orgSlug, appSubdomain },
  } = router;

  const baseUrl = `/orgs/${orgSlug}/projects/${appSubdomain}/ai`;
  const finalUrl = href && href !== '/' ? `${baseUrl}${href}` : baseUrl;

  const active = exact
    ? router.asPath === finalUrl
    : router.asPath.startsWith(finalUrl);

  return (
    <ListNavLink
      href={finalUrl}
      underline="none"
      onClick={onClick}
      className={cn(
        'h-auto justify-start gap-2.5 rounded-md px-2 py-1.5',
        dashboardNavItemTextClassName,
        active &&
          'bg-neutral-100 font-medium text-primary hover:bg-neutral-100 hover:text-primary dark:bg-[#313438] dark:text-primary dark:hover:bg-[#313438] dark:hover:text-primary',
      )}
    >
      {children}
    </ListNavLink>
  );
}

export default function AISidebar() {
  const { project } = useProject();

  if (!project) {
    return null;
  }

  return (
    <FeatureSidebar
      mobileBreakpoint="md"
      withErrorBoundary={false}
      className="!w-[200px] !max-w-[200px] px-2"
    >
      {(collapse) => (
        <nav aria-label="AI navigation" className="grid gap-2">
          <AINavLink href="/auto-embeddings" exact={false} onClick={collapse}>
            Auto-Embeddings
          </AINavLink>
          <AINavLink href="/assistants" exact={false} onClick={collapse}>
            Assistants
          </AINavLink>
          <AINavLink href="/file-stores" exact={false} onClick={collapse}>
            File Stores
          </AINavLink>
        </nav>
      )}
    </FeatureSidebar>
  );
}
