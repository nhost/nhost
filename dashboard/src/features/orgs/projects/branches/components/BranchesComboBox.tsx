import { ListTree } from 'lucide-react';
import { useRouter } from 'next/router';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import { CommandItem, CommandSeparator } from '@/components/ui/v3/command';
import {
  BranchIcon,
  BranchStatusMark,
  ProductionBadge,
} from '@/features/orgs/projects/branches/components/BranchBits';
import { useDummyBranches } from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
import { triggerToast } from '@/utils/toast';

/**
 * Third header switcher: production on top, then the branches of the current
 * project. Branches come from GitHub pull requests, so there's no "New branch"
 * here; the footer opens the project's Branches page.
 */
export default function BranchesComboBox() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const {
    isReady,
    branches,
    currentBranch,
    switchTo,
    githubConnected,
    waiting,
  } = useDummyBranches();

  if (!isReady) {
    return null;
  }

  const branchesHref = `/orgs/${orgSlug}/projects/${appSubdomain}/branches`;
  // Without GitHub there are no branches, only production.
  const visible = githubConnected
    ? branches
    : branches.filter((b) => b.isProduction);

  const options = visible.map((branch) => ({
    value: branch.id,
    label: branch.name,
    group: branch.isProduction ? 'Production' : 'Branches',
    disabled: branch.status === 'creating' || branch.status === 'deleting',
    // Inside the list the names stay monospace, like git branch names.
    render: (
      <div className="flex w-full min-w-0 items-center gap-2">
        <BranchIcon branch={branch} />
        {/* Long names truncate before the tags, never under them; the full
            name shows on hover. */}
        <span
          className="min-w-0 flex-1 truncate font-mono text-[13px]"
          title={branch.name}
        >
          {branch.name}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 pl-3">
          {branch.isProduction && <ProductionBadge />}
          <BranchStatusMark status={branch.status} hideReady />
        </span>
      </div>
    ),
  }));

  // The trigger uses the same font as the organization and project switchers.
  const label = (
    <span className="flex min-w-0 items-center gap-2">
      {/* Green while the branch you're on is ready, red if it failed, blue
          pulse while it deploys: you notice with the dropdown closed. */}
      <BranchIcon branch={currentBranch} current />
      <span className="truncate">{currentBranch.name}</span>
    </span>
  );

  const footerSlot = (
    <>
      <CommandSeparator className="mt-1" />
      <CommandItem
        forceMount
        value="manage-branches"
        onSelect={() => router.push(`${branchesHref}?tab=all`)}
      >
        <ListTree className="mr-2 size-4" />
        Manage branches
        {/* Waiting pull requests have no branch to open yet, so they're
            only counted here, next to the page that lists them. */}
        {githubConnected && waiting.length > 0 && (
          <span className="ml-auto text-muted-foreground text-xs">
            {waiting.length} waiting
          </span>
        )}
      </CommandItem>
    </>
  );

  return (
    <HeaderCombobox
      options={options}
      value={currentBranch.id}
      placeholder="Select a branch"
      searchPlaceholder="Find a branch..."
      emptyText="No branch with that name."
      footerSlot={footerSlot}
      // Fixed width, so long branch names truncate instead of stretching it.
      popoverContentClassName="w-80 max-w-[calc(100vw-2rem)]"
      // Like the organization and project switchers: the name goes to the
      // project's overview (on this branch), the chevron opens the list.
      linkHref={`/orgs/${orgSlug}/projects/${appSubdomain}`}
      linkContent={label}
      aria-label="Switch branch"
      onChange={(id) => {
        if (id === currentBranch.id) {
          return;
        }
        switchTo(id);
        const target = branches.find((b) => b.id === id);
        triggerToast(`Opened ${target?.name}`);
      }}
    />
  );
}
