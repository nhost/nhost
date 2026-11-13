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
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { ProjectStateGate } from '@/features/orgs/guards/ProjectStateGate';
import { useDummyBranches } from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
import { triggerToast } from '@/utils/toast';

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
  const {
    resetDemo,
    githubConnected,
    setGithubConnected,
    demoClosePullRequest,
    branchCount,
  } = useDummyBranches();
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
            {/* How many branches are open (production not counted), in the
                dashboard's own Badge, primary blue. A hard
                shadow in the primary button's depth color lifts the number. Hidden when there are none. */}
            {githubConnected && branchCount > 0 && (
              <Badge className="ml-auto px-1.5 py-0 font-medium tabular-nums [text-shadow:0_1px_0_hsl(var(--primary-emboss-depth)/0.6)] hover:bg-primary">
                {branchCount}
              </Badge>
            )}
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
      {/* DUMMY PROTOTYPE: remove before staging. */}
      <div className="hidden shrink-0 gap-1 border-t p-3 md:grid">
        <Button
          variant="ghost"
          size="xs"
          className="w-full text-muted-foreground"
          onClick={() => setGithubConnected(!githubConnected)}
        >
          {githubConnected ? 'Demo without GitHub' : 'Demo with GitHub'}
        </Button>
        <Button
          variant="ghost"
          size="xs"
          className="w-full text-muted-foreground"
          onClick={() => {
            const closed = demoClosePullRequest();
            if (closed) {
              triggerToast(
                `#${closed.pullRequest} merged, ${closed.name} removed`,
              );
            }
          }}
        >
          Demo a merged pull request
        </Button>
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
  const { projectName, initialData } = useDummyBranches();
  return (
    <p className="text-muted-foreground text-sm">
      Each pull request gets its own copy of{' '}
      <span className="font-medium text-foreground">{projectName}</span>
      {initialData === 'empty' && ', structure only, no data.'}
      {initialData === 'seed' && ', filled with your seed data.'}
      {initialData === 'parentBackup' &&
        ", filled from production's latest backup."}
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
        {tab === 'all' && <ClientIntro />}
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
