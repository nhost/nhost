import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/v3/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';

type Option = {
  value: string;
  label: string;
  plan: string;
};

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

  const {
    query: { orgSlug },
    pathname,
    push,
  } = useRouter();

  const orgScopedPathname = ORG_TAB_PATHNAMES.has(pathname)
    ? pathname
    : '/orgs/[orgSlug]/projects';

  const selectedOrgFromUrl =
    Boolean(orgSlug) && orgs.find((item) => item.slug === orgSlug);

  const [selectedItem, setSelectedItem] = useState<Option | null>(null);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  useEffect(() => {
    const selectedItemFromUrl = selectedOrgFromUrl;

    if (selectedItemFromUrl) {
      setSelectedItem({
        label: selectedItemFromUrl.name,
        value: selectedItemFromUrl.slug,
        plan: selectedOrgFromUrl ? selectedOrgFromUrl.plan.name : 'Legacy',
      });
    }
  }, [selectedOrgFromUrl]);

  const orgsOptions: Option[] = orgs.map((org) => ({
    label: org.name,
    value: org.slug,
    plan: org.plan.name,
  }));

  const [open, setOpen] = useState(false);

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

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            size="sm"
            variant="ghost"
            className="max-w-xl justify-between gap-2 bg-background px-2 text-foreground hover:bg-accent dark:hover:bg-muted"
          >
            {selectedItem ? (
              <div className="flex min-w-0 flex-1 flex-row items-center">
                <span className="truncate">{selectedItem.label}</span>
                {renderBadge(selectedItem.plan)}
              </div>
            ) : (
              'Select organization'
            )}
            <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-fit min-w-[var(--radix-popover-trigger-width)] max-w-xl p-0"
          side="bottom"
          align="start"
        >
          <Command>
            <CommandInput placeholder="Select organization..." />
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>
              <CommandGroup heading="Organizations">
                {orgsOptions.map((option) => (
                  <CommandItem
                    keywords={[option.label]}
                    key={option.value}
                    value={option.value}
                    className="flex items-center text-foreground dark:hover:bg-muted"
                    onSelect={() => {
                      setSelectedItem(option);
                      setOpen(false);

                      // persist last slug in local storage
                      setLastSlug(option.value);

                      push(
                        orgScopedPathname.replace('[orgSlug]', option.value),
                      );
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4 shrink-0',
                        selectedItem?.value === option.value
                          ? 'opacity-100'
                          : 'opacity-0',
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate">
                      {option.label}
                    </span>
                    {renderBadge(option.plan)}
                  </CommandItem>
                ))}
              </CommandGroup>
              {isPlatform && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      className="flex items-center text-foreground dark:hover:bg-muted"
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
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateOrgDialog
        hideNewOrgButton
        isOpen={createOrgOpen}
        onOpenStateChange={setCreateOrgOpen}
      />
    </>
  );
}
