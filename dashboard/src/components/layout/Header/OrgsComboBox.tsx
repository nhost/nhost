import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import { Badge } from '@/components/ui/v3/badge';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';

export default function OrgsComboBox() {
  const { orgs } = useOrgs();
  const isPlatform = useIsPlatform();
  const [, setLastSlug] = useSSRLocalStorage<string | null>('slug', null);

  const {
    query: { orgSlug },
    push,
  } = useRouter();
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  const selectedOrg = orgSlug
    ? orgs.find((item) => item.slug === orgSlug)
    : undefined;

  // One tone per plan tier, each with its own border/background/text color
  // so Starter, Pro, Team and Enterprise read as visually distinct at a
  // glance instead of all collapsing into the same solid badge.
  const PLAN_TONES: Record<string, string> = {
    Starter: 'border-foreground/15 bg-foreground/[0.06] text-foreground/80',
    Pro: 'border-primary/20 bg-primary/[0.07] text-primary',
    Team: 'border-violet-500/20 bg-violet-500/[0.08] text-violet-600 dark:text-violet-300',
    Enterprise:
      'border-amber-500/20 bg-amber-500/[0.08] text-amber-600 dark:text-amber-300',
  };

  const renderBadge = (plan: string) => {
    if (!isPlatform) {
      return null;
    }

    return (
      <Badge
        variant="outline"
        className={cn(
          PLAN_TONES[plan],
          plan === 'Legacy'
            ? 'border-transparent bg-orange-200 text-foreground hover:bg-orange-200 dark:bg-orange-500'
            : '',
          'hover:none ml-2 h-5 px-[6px] text-[10px]',
        )}
      >
        {plan}
      </Badge>
    );
  };

  const options = orgs.map((org) => {
    const projectCount = org.apps?.length ?? 0;
    const projectCountLabel =
      projectCount === 0
        ? 'No projects'
        : `${projectCount} project${projectCount === 1 ? '' : 's'}`;

    const isSelected = org.slug === selectedOrg?.slug;

    return {
      value: org.slug,
      label: org.name,
      className: isSelected
        ? 'bg-primary/[0.06] font-medium dark:bg-primary/[0.08]'
        : undefined,
      render: (
        <div className="flex w-full items-center justify-between gap-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate">{org.name}</span>
            <span className="mt-0.5 block truncate text-muted-foreground text-xs">
              {projectCountLabel}
            </span>
          </span>
          {renderBadge(org.plan?.name ?? 'Legacy')}
        </div>
      ),
    };
  });

  const triggerLabel = selectedOrg ? (
    <div className="flex flex-row items-center justify-center">
      {selectedOrg.name}
      {renderBadge(selectedOrg.plan?.name ?? 'Legacy')}
    </div>
  ) : null;

  const footerSlot = (
    <div className="border-t p-1">
      <button
        type="button"
        onClick={() => setCreateOrgOpen(true)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 font-medium text-primary text-sm hover:bg-primary/10"
      >
        <Plus className="h-3.5 w-3.5" />
        New Organization
      </button>
    </div>
  );

  return (
    <>
      <CreateOrgDialog
        hideNewOrgButton
        isOpen={createOrgOpen}
        onOpenStateChange={setCreateOrgOpen}
      />
      <HeaderCombobox
        data-testid="org-switcher"
        options={options}
        value={selectedOrg?.slug ?? null}
        triggerLabel={triggerLabel}
        placeholder="Select organization"
        footerSlot={footerSlot}
        popoverContentClassName="w-[290px]"
        linkHref={
          selectedOrg ? `/orgs/${selectedOrg.slug}/projects` : undefined
        }
        linkContent={triggerLabel}
        aria-label="Switch organization"
        onChange={(slug) => {
          setLastSlug(slug);
          push(`/orgs/${slug}/projects`);
        }}
      />
    </>
  );
}
