import { GitBranch, Group } from 'lucide-react';
import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CommandGroup, CommandItem } from '@/components/ui/v3/command';
import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import useColumnGroups from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete/useColumnGroups';
import type { FetchMetadataReturnType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { RuleNode } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import AddNodeMenu from './AddNodeMenu';
import useCustomCheckEditor from './useCustomCheckEditor';

interface AddNodeButtonProps {
  onSelect: (node: RuleNode) => void;
  fullWidth?: boolean;
  label?: string;
}

export default function AddNodeButton({
  onSelect,
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

  const { data: metadata, status: metadataStatus } = useExportMetadata(
    (data) => {
      const source = data.metadata.sources?.find((s) => s.name === 'default');

      return source
        ? ({
            ...source,
            resourceVersion: data.resource_version,
          } as FetchMetadataReturnType)
        : ({
            resourceVersion: data.resource_version,
          } as FetchMetadataReturnType);
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
    <AddNodeMenu
      open={open}
      onOpenChange={setOpen}
      disabled={!hasTable}
      fullWidth={fullWidth}
      label={label}
      isLoading={isLoading}
      columns={columns.map((option) => ({
        value: option.value,
        label: option.label,
        badge: option.metadata?.udt_name,
      }))}
      onSelectColumn={handleColumnSelect}
      onSelectGroup={handleGroupSelect}
      extraOperators={
        <CommandItem value="_exists" onSelect={handleExistsSelect}>
          <Group className="mr-2 h-4 w-4 text-muted-foreground" />
          exists
        </CommandItem>
      }
      extraGroups={
        relationships.length > 0 && (
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
        )
      }
    />
  );
}
