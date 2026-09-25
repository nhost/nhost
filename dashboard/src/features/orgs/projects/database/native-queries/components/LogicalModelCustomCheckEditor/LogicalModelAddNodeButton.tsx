import { Columns, Group, Plus } from 'lucide-react';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
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
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { cn } from '@/lib/utils';
import useLogicalModelCustomCheckEditor from './useLogicalModelCustomCheckEditor';

interface LogicalModelAddNodeButtonProps {
  onSelectNode: (node: RuleNode) => void;
  fullWidth?: boolean;
  label?: string;
}

export default function LogicalModelAddNodeButton({
  onSelectNode,
  fullWidth,
  label = 'Add check',
}: LogicalModelAddNodeButtonProps) {
  const [open, setOpen] = useState(false);
  const { fields } = useLogicalModelCustomCheckEditor();

  function addColumn(column: string) {
    onSelectNode({
      type: 'condition',
      id: uuidv4(),
      column,
      operator: '_eq',
      value: null,
    });
    setOpen(false);
  }

  function addGroup(operator: '_and' | '_or' | '_not') {
    onSelectNode({ type: 'group', id: uuidv4(), operator, children: [] });
    setOpen(false);
  }

  function addExists() {
    onSelectNode({
      type: 'exists',
      id: uuidv4(),
      schema: '',
      table: '',
      where: {
        type: 'group',
        id: uuidv4(),
        operator: '_implicit',
        children: [],
      },
    });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
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
        className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0"
      >
        <Command>
          <CommandInput autoFocus placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup heading="Boolean operators">
              {(['_and', '_or', '_not'] as const).map((operator) => (
                <CommandItem
                  key={operator}
                  value={operator}
                  onSelect={() => addGroup(operator)}
                >
                  <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                  {operator.slice(1)}
                </CommandItem>
              ))}
              <CommandItem value="_exists" onSelect={addExists}>
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                exists
              </CommandItem>
            </CommandGroup>
            {fields.length > 0 ? (
              <CommandGroup heading="Fields">
                {fields.map((field) => (
                  <CommandItem
                    key={field.name}
                    value={field.name}
                    onSelect={() => addColumn(field.name)}
                  >
                    <Columns className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{field.name}</span>
                    <code className="ml-auto rounded bg-primary px-1 font-mono text-white text-xs">
                      {field.scalar}
                    </code>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
