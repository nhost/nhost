import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import { Badge } from '@/components/ui/v3/badge';
import { CommandItem, CommandSeparator } from '@/components/ui/v3/command';
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

  const renderBadge = (plan: string) => {
    if (!isPlatform) {
      return null;
    }

    return (
      <Badge
        variant={plan === 'Starter' ? 'outline' : 'default'}
        className={cn(
          plan === 'Starter' ? 'bg-muted' : '',
          plan === 'Legacy'
            ? 'bg-orange-200 text-foreground hover:bg-orange-200 dark:bg-orange-500'
            : '',
          'hover:none ml-2 h-5 px-[6px] text-[10px]',
        )}
      >
        {plan}
      </Badge>
    );
  };

  const options = orgs.map((org) => ({
    value: org.slug,
    label: org.name,
    render: (
      <div className="flex w-full items-center justify-between">
        <span className="truncate">{org.name}</span>
        {renderBadge(org.plan?.name ?? 'Legacy')}
      </div>
    ),
  }));

  const triggerLabel = selectedOrg ? (
    <div className="flex flex-row items-center justify-center">
      {selectedOrg.name}
      {renderBadge(selectedOrg.plan?.name ?? 'Legacy')}
    </div>
  ) : null;

  const footerSlot = (
    <>
      <CommandSeparator className="mt-1" />
      <CommandItem
        forceMount
        value="new-organization"
        onSelect={() => setCreateOrgOpen(true)}
      >
        <Plus className="mr-2 h-4 w-4" />
        New Organization
      </CommandItem>
    </>
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
        searchPlaceholder="Select organization..."
        footerSlot={footerSlot}
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
