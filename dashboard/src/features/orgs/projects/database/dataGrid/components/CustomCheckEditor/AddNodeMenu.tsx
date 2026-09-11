import { CommandLoading } from 'cmdk';
import { Columns, Group, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
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
import { cn } from '@/lib/utils';

export interface AddNodeMenuColumn {
  value: string;
  label: string;
  badge?: string;
}

export interface AddNodeMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  label: string;
  isLoading?: boolean;
  columns: AddNodeMenuColumn[];
  onSelectColumn: (value: string) => void;
  onSelectGroup: (operator: '_and' | '_or' | '_not') => void;
  /** Rendered after the built-in and/or/not items. */
  extraOperators?: ReactNode;
  /** Rendered after the Columns group. */
  extraGroups?: ReactNode;
}

export default function AddNodeMenu({
  open,
  onOpenChange,
  disabled,
  fullWidth,
  label,
  isLoading,
  columns,
  onSelectColumn,
  onSelectGroup,
  extraOperators,
  extraGroups,
}: AddNodeMenuProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-muted-foreground',
            fullWidth && 'w-full',
          )}
        >
          <Plus className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
      >
        <Command>
          <CommandInput autoFocus placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            {isLoading && <CommandLoading>Loading...</CommandLoading>}
            <CommandGroup heading="Boolean operators">
              <CommandItem value="_and" onSelect={() => onSelectGroup('_and')}>
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                and
              </CommandItem>
              <CommandItem value="_or" onSelect={() => onSelectGroup('_or')}>
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                or
              </CommandItem>
              <CommandItem value="_not" onSelect={() => onSelectGroup('_not')}>
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                not
              </CommandItem>
              {extraOperators}
            </CommandGroup>
            {columns.length > 0 && (
              <CommandGroup heading="Columns">
                {columns.map((column) => (
                  <CommandItem
                    key={column.value}
                    value={column.value}
                    onSelect={onSelectColumn}
                  >
                    <Columns className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{column.label}</span>
                    {column.badge && (
                      <code className="ml-auto rounded bg-primary px-1 font-mono text-white text-xs">
                        {column.badge}
                      </code>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {extraGroups}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
