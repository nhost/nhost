import { CommandLoading } from 'cmdk';
import { Columns, GitBranch, Group, Plus } from 'lucide-react';
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
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import useColumnGroups from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete/useColumnGroups';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { cn } from '@/lib/utils';
import useCustomCheckEditor from './useCustomCheckEditor';

interface AddNodeButtonProps {
  onSelect: (node: RuleNode) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  label?: string;
}

export default function AddNodeButton({
  onSelect,
  disabled,
  fullWidth,
  label = 'Add check',
}: AddNodeButtonProps) {
  const [open, setOpen] = useState(false);
  const { schema, table } = useCustomCheckEditor();

  const hasTable = Boolean(schema && table);

  const { data: tableData, status: tableStatus } = useTableSchemaQuery(
    [`default.${schema}.${table}`],
    {
      schema,
      table,
      queryOptions: { refetchOnWindowFocus: false, enabled: hasTable },
    },
  );

  const { data: metadata, status: metadataStatus } = useMetadataQuery(
    [`default.metadata`],
    {
      queryOptions: { refetchOnWindowFocus: false },
    },
  );

  const options = useColumnGroups({
    selectedSchema: schema,
    selectedTable: table,
    tableData,
    metadata,
  });

  const columns = options.filter((option) => option.group === 'columns');
  const relationships = options.filter(
    (option) => option.group === 'relationships',
  );

  const isLoading = tableStatus === 'loading' || metadataStatus === 'loading';

  function handleColumnSelect(columnName: string) {
    onSelect({
      type: 'condition',
      id: uuidv4(),
      column: columnName,
      operator: '_eq',
      value: null,
    });
    setOpen(false);
  }

  function handleRelationshipSelect(relationshipName: string) {
    onSelect({
      type: 'relationship',
      id: uuidv4(),
      relationship: relationshipName,
      child: {
        type: 'group',
        id: uuidv4(),
        operator: '_and',
        children: [],
      },
    });
    setOpen(false);
  }

  function handleGroupSelect(operator: '_and' | '_or' | '_not') {
    onSelect({
      type: 'group',
      id: uuidv4(),
      operator,
      children: [],
    });
    setOpen(false);
  }

  function handleExistsSelect() {
    onSelect({
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
              <CommandItem
                value="_and"
                onSelect={() => handleGroupSelect('_and')}
              >
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                and
              </CommandItem>
              <CommandItem
                value="_or"
                onSelect={() => handleGroupSelect('_or')}
              >
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                or
              </CommandItem>
              <CommandItem
                value="_not"
                onSelect={() => handleGroupSelect('_not')}
              >
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                not
              </CommandItem>
              <CommandItem value="_exists" onSelect={handleExistsSelect}>
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                exists
              </CommandItem>
            </CommandGroup>
            {columns.length > 0 && (
              <CommandGroup heading="Columns">
                {columns.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={handleColumnSelect}
                  >
                    <Columns className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{option.label}</span>
                    {option.metadata?.udt_name && (
                      <code className="ml-auto rounded bg-primary px-1 font-mono text-white text-xs">
                        {option.metadata.udt_name}
                      </code>
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {relationships.length > 0 && (
              <CommandGroup heading="Relationships">
                {relationships.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={handleRelationshipSelect}
                  >
                    <GitBranch className="mr-2 h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
