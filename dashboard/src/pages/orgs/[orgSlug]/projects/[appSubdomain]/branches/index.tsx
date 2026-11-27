import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  AreaSidebarGroup,
  AreaSidebarLink,
  AreaSidebarNav,
  AreaSidebarRoot,
} from '@/components/layout/AreaSidebar';
import { NavigationSearch } from '@/features/command-palette/CommandPaletteProvider';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

// DUMMY PROTOTYPE: client-only, the fake branches live in localStorage.
const AllBranches = dynamic(
  () => import('@/features/orgs/projects/branches/components/AllBranches'),
  { ssr: false },
);
const BranchSettings = dynamic(
  () => import('@/features/orgs/projects/branches/components/BranchSettings'),
  { ssr: false },
);

const TABS = {
  all: {
    title: 'All branches',
    Component: AllBranches,
  },
  settings: {
    title: 'Settings',
    Component: BranchSettings,
  },
} as const;

type Tab = keyof typeof TABS;

function BranchesSidebar() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const path = `/orgs/${orgSlug}/projects/${appSubdomain}/branches`;

  return (
    <AreaSidebarRoot className="flex flex-col bg-background md:border-r">
      <div className="hidden px-2 pt-2 md:block">
        <NavigationSearch />
      </div>
      <AreaSidebarNav
        ariaLabel="Branches navigation"
        className="h-auto min-h-0 flex-1 pt-2 md:overflow-auto md:pt-4"
      >
        <AreaSidebarGroup label="Manage">
          <AreaSidebarLink
            href={`${path}?tab=all`}
            exact
            shallow
            scroll={false}
          >
            All branches
          </AreaSidebarLink>
          <AreaSidebarLink
            href={`${path}?tab=settings`}
            exact
            shallow
            scroll={false}
          >
            Settings
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
    </AreaSidebarRoot>
  );
}

export default function BranchesPage() {
  const router = useRouter();
  const tab = getSingleQueryParam(router.query.tab) as Tab | undefined;

  useEffect(() => {
    if (router.isReady && (!tab || !(tab in TABS))) {
      void router.replace(
        { pathname: router.pathname, query: { ...router.query, tab: 'all' } },
        undefined,
        { shallow: true },
      );
    }
  }, [router, tab]);

  if (!tab || !(tab in TABS)) {
    return null;
  }

  const { title, Component } = TABS[tab];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-5 py-8">
      <header className="grid gap-1">
        <h1 className="font-semibold text-xl">{title}</h1>
      </header>
      <Component />
    </div>
  );
}

BranchesPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AppLayout hideSidebar>
      <ProjectScope>
        <ProjectStateGate>
          <div className="flex h-full min-h-0 flex-col md:flex-row">
            <BranchesSidebar />
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{page}</div>
          </div>
        </ProjectStateGate>
      </ProjectScope>
    </AppLayout>
  );
};
