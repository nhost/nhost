import { useFormContext } from 'react-hook-form';
import { Combobox } from '@/components/ui/v3/combobox';
import { FormField, FormMessage } from '@/components/ui/v3/form';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import useColumnGroups from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete/useColumnGroups';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import { cn, isNotEmptyValue } from '@/lib/utils';
import useCustomCheckEditor from './useCustomCheckEditor';

interface RelationshipComboBoxProps {
  name: string;
  relationship: string;
  onChange: (value: { name: string; schema: string; table: string }) => void;
}

export default function RelationshipComboBox({
  name,
  relationship,
  onChange,
}: RelationshipComboBoxProps) {
  const { control } = useFormContext();
  const { schema, table } = useCustomCheckEditor();

  const { data: tableData } = useTableSchemaQuery(
    [`default.${schema}.${table}`],
    {
      schema,
      table,
      queryOptions: { refetchOnWindowFocus: false },
    },
  );

  const { data: metadata } = useMetadataQuery([`default.metadata`], {
    queryOptions: { refetchOnWindowFocus: false },
  });

  const options = useColumnGroups({
    selectedSchema: schema,
    selectedTable: table,
    tableData,
    metadata,
  });

  const relationships = options.filter(
    (option) => option.group === 'relationships',
  );

  const metadataLoaded = Boolean(tableData && metadata);

  const handleSelect = (value: string) => {
    const found = relationships.find((r) => r.value === value);
    if (found) {
      const target = found.metadata?.target as {
        schema: string;
        table: string;
        name: string;
      };
      onChange({
        name: found.value,
        schema: target?.schema || 'public',
        table: target?.table || '',
      });
    }
  };

  return (
    <FormField
      name={`${name}.relationship`}
      control={control}
      rules={{
        validate: (value) => {
          return (
            !value ||
            !metadataLoaded ||
            relationships.some((r) => r.value === value) ||
            `Unknown relationship "${value}"`
          );
        },
      }}
      render={({ fieldState }) => {
        const hasError = isNotEmptyValue(fieldState.error?.message);
        return (
          <div className="flex flex-col gap-2">
            <Combobox
              options={relationships}
              value={relationship || null}
              onChange={handleSelect}
              placeholder="Select relationship..."
              searchPlaceholder="Search relationship..."
              emptyText="No relationships found."
              className={cn({
                'border-destructive text-destructive': hasError,
              })}
              popoverContentClassName="w-80"
            />
            <FormMessage />
          </div>
        );
      }}
    />
  );
}
