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
import { Button } from '@/components/ui/v3/button';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { useDummyBranches } from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';

// DUMMY PROTOTYPE: client-only, the fake branches live in localStorage.
const AllBranches = dynamic(
  () => import('@/features/orgs/projects/branches/components/AllBranches'),
  { ssr: false },
);
const MergeRequests = dynamic(
  () => import('@/features/orgs/projects/branches/components/MergeRequests'),
  { ssr: false },
);
const NewBranchForm = dynamic(
  () => import('@/features/orgs/projects/branches/components/NewBranchForm'),
  { ssr: false },
);

const TABS = {
  all: {
    title: 'All branches',
    Component: AllBranches,
  },
  'merge-requests': {
    title: 'Merge requests',
    Component: MergeRequests,
  },
  new: {
    title: 'New branch',
    Component: NewBranchForm,
  },
} as const;

type Tab = keyof typeof TABS;

function BranchesSidebar() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const { resetDemo } = useDummyBranches();
  const path = `/orgs/${orgSlug}/projects/${appSubdomain}/branches`;

  return (
    <AreaSidebarRoot className="flex flex-col bg-background md:border-r">
      <div className="shrink-0 border-b px-4 py-3 font-medium text-sm">
        Branches
      </div>
      <AreaSidebarNav
        ariaLabel="Branches navigation"
        className="h-auto min-h-0 flex-1 pt-2 md:overflow-auto"
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
            href={`${path}?tab=merge-requests`}
            exact
            shallow
            scroll={false}
          >
            Merge requests
          </AreaSidebarLink>
          <AreaSidebarLink
            href={`${path}?tab=new`}
            exact
            shallow
            scroll={false}
          >
            New branch
          </AreaSidebarLink>
        </AreaSidebarGroup>
      </AreaSidebarNav>
      {/* DUMMY PROTOTYPE: remove before staging. */}
      <div className="hidden shrink-0 border-t p-3 md:block">
        <Button
          variant="ghost"
          size="xs"
          className="w-full text-muted-foreground"
          onClick={resetDemo}
        >
          Reset demo data
        </Button>
      </div>
    </AreaSidebarRoot>
  );
}

function BranchesIntro() {
  const { projectName } = useDummyBranches();
  return (
    <p className="text-muted-foreground text-sm">
      Every branch is a copy of {projectName}'s structure, without its data. Try
      changes safely, then merge them into production.
    </p>
  );
}

const ClientIntro = dynamic(() => Promise.resolve(BranchesIntro), {
  ssr: false,
});

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
        <ClientIntro />
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
