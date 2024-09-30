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
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

type Option = {
  value: string;
  label: string;
  plan: string;
};

export default function OrgsComboBox() {
  const {
    query: { orgSlug },
    push,
  } = useRouter();

  const { orgs } = useOrgs();

  const selectedOrgFromUrl = orgs.find((item) => item.slug === orgSlug);

  const [selectedOrg, setSelectedOrg] = useState<Option | null>(null);

  useEffect(() => {
    if (selectedOrgFromUrl) {
      setSelectedOrg({
        label: selectedOrgFromUrl.name,
        value: selectedOrgFromUrl.slug,
        plan: selectedOrgFromUrl.plan.name,
      });
    }
  }, [selectedOrgFromUrl]);

  const options: Option[] = orgs.map((org) => ({
    label: org.name,
    value: org.slug,
    plan: org.plan.name,
  }));

  const [open, setOpen] = useState(false);

  const renderBadge = (plan: string) => (
    <Badge
      variant={plan === 'Starter' ? 'outline' : 'default'}
      className={cn(
        plan === 'Starter' ? 'bg-muted' : '',
        'hover:none ml-2 h-5 px-[6px] text-[10px]',
      )}
    >
      {plan}
    </Badge>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="justify-start gap-2 text-foreground"
        >
          {selectedOrg ? (
            <div className="flex flex-row items-center justify-center">
              {selectedOrg.label}
              {renderBadge(selectedOrg.plan)}
            </div>
          ) : (
            <>Select organization</>
          )}
          <ChevronsUpDown className="h-5 w-5 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" side="bottom" align="start">
        <Command>
          <CommandInput placeholder="Select organization..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    setSelectedOrg(option);
                    setOpen(false);
                    push(`/orgs/${option.value}/projects`);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      selectedOrg?.value === option.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                  <span className="max-w-52 truncate">{option.label}</span>
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
