import { Check, ChevronsUpDown } from 'lucide-react';
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
} from '@/components/ui/v3/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';

type Option = {
  value: string;
  label: string;
  plan: string;
};

export default function OrgsComboBox() {
  const { orgs } = useOrgs();
  const isPlatform = useIsPlatform();
  const [, setLastSlug] = useSSRLocalStorage<string | null>('slug', null);

  const {
    query: { orgSlug },
    push,
  } = useRouter();

  const selectedOrgFromUrl =
    Boolean(orgSlug) && orgs.find((item) => item.slug === orgSlug);

  const [selectedItem, setSelectedItem] = useState<Option | null>(null);

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
          'hover:none ml-2 h-5 px-[6px] text-[10px]',
        )}
      >
        {plan}
      </Badge>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="w-full justify-between gap-2 bg-background text-foreground hover:bg-accent dark:hover:bg-muted"
        >
          {selectedItem ? (
            <div className="flex flex-row items-center justify-center">
              {selectedItem.label}
              {renderBadge(selectedItem.plan)}
            </div>
          ) : (
            'Select organization'
          )}
          <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="bottom" align="start">
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

                    push(`/orgs/${option.value}/projects`);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedItem?.value === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <span className="w-full truncate">{option.label}</span>
                  {renderBadge(option.plan)}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
