import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';

import HeaderCombobox from '@/components/layout/Header/HeaderCombobox';
import { Badge } from '@/components/ui/v3/badge';
import {
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@/components/ui/v3/command';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';

const ORG_TAB_PATHNAMES = new Set([
  '/orgs/[orgSlug]/projects',
  '/orgs/[orgSlug]/members',
  '/orgs/[orgSlug]/billing',
  '/orgs/[orgSlug]/settings',
]);

export default function OrgsComboBox() {
  const { orgs } = useOrgs();
  const isPlatform = useIsPlatform();
  const [, setLastSlug] = useSSRLocalStorage<string | null>('slug', null);
  const [open, setOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  const {
    query: { orgSlug },
    pathname,
    push,
  } = useRouter();

  const orgScopedPathname = ORG_TAB_PATHNAMES.has(pathname)
    ? pathname
    : '/orgs/[orgSlug]/projects';
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
          'hover:none ml-2 h-5 shrink-0 whitespace-nowrap px-[6px] text-[10px]',
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
    <div className="flex min-w-0 items-center">
      <span className="truncate font-semibold">{selectedOrg.name}</span>
      {renderBadge(selectedOrg.plan?.name ?? 'Legacy')}
    </div>
  ) : null;

  return (
    <>
      <HeaderCombobox
        data-testid="org-switcher"
        options={options}
        value={selectedOrg?.slug ?? null}
        triggerLabel={triggerLabel}
        placeholder="Select organization"
        searchPlaceholder="Select organization..."
        className="min-w-[231px] max-w-xl justify-between"
        open={open}
        onOpenChange={setOpen}
        footerSlot={
          isPlatform ? (
            <>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false);
                    setCreateOrgOpen(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  <span>New Organization</span>
                </CommandItem>
              </CommandGroup>
            </>
          ) : null
        }
        onChange={(slug) => {
          setLastSlug(slug);
          push(orgScopedPathname.replace('[orgSlug]', slug));
        }}
      />

      <CreateOrgDialog
        hideNewOrgButton
        isOpen={createOrgOpen}
        onOpenStateChange={setCreateOrgOpen}
      />
    </>
  );
}
