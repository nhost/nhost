import { ListTree, Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import { CommandItem, CommandSeparator } from '@/components/ui/v3/command';
import {
  BranchIcon,
  BranchStatusMark,
  GitHubMirrorMark,
  OpenRequestChip,
  ProductionBadge,
} from '@/features/orgs/projects/branches/components/BranchBits';
import { useDummyBranches } from '@/features/orgs/projects/branches/dummy/useDummyBranches';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
import { triggerToast } from '@/utils/toast';

/**
 * Third header switcher: production on top, then the branches of the current
 * project. Footer actions open the project's Branches page.
 */
export default function BranchesComboBox() {
  const router = useRouter();
  const orgSlug = getSingleQueryParam(router.query.orgSlug);
  const appSubdomain = getSingleQueryParam(router.query.appSubdomain);
  const { isReady, branches, currentBranch, openRequestFor, switchTo } =
    useDummyBranches();

  if (!isReady) {
    return null;
  }

  const branchesHref = `/orgs/${orgSlug}/projects/${appSubdomain}/branches`;

  const options = branches.map((branch) => {
    const request = openRequestFor(branch.name);
    return {
      value: branch.id,
      label: branch.name,
      group: branch.isProduction ? 'Production' : 'Branches',
      disabled: branch.status === 'creating',
      render: (
        <div className="flex w-full min-w-0 items-center gap-2">
          <BranchIcon branch={branch} />
          <span className="max-w-48 truncate font-mono text-[13px]">
            {branch.name}
          </span>
          {branch.source === 'github' && (
            <GitHubMirrorMark gitBranch={branch.gitBranch} />
          )}
          <span className="ml-auto flex shrink-0 items-center gap-1.5 pl-3">
            {branch.isProduction && <ProductionBadge />}
            {request && <OpenRequestChip request={request} compact />}
            <BranchStatusMark branch={branch} />
          </span>
        </div>
      ),
    };
  });

  const label = (
    <span className="flex min-w-0 items-center gap-2">
      <BranchIcon
        branch={currentBranch}
        className={currentBranch.isProduction ? undefined : 'text-warning'}
      />
      <span className="truncate font-mono text-[13px]">
        {currentBranch.name}
      </span>
    </span>
  );

  const footerSlot = (
    <>
      <CommandSeparator className="mt-1" />
      <CommandItem
        forceMount
        value="new-branch"
        onSelect={() => router.push(`${branchesHref}?tab=new`)}
      >
        <Plus className="mr-2 size-4" />
        New branch
      </CommandItem>
      <CommandItem
        forceMount
        value="manage-branches"
        onSelect={() => router.push(`${branchesHref}?tab=all`)}
      >
        <ListTree className="mr-2 size-4" />
        Manage branches
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
      popoverContentClassName="min-w-80"
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
