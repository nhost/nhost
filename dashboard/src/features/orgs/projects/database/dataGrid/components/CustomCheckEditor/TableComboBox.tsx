import { Combobox } from '@/components/ui/v3/combobox';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';

interface TableComboBoxProps {
  schema: string;
  table: string;
  onChange: (value: { schema: string; table: string }) => void;
}

export default function TableComboBox({
  schema,
  table,
  onChange,
}: TableComboBoxProps) {
  const { data: metadata } = useMetadataQuery(['default.metadata']);

  const tables = (metadata?.tables ?? []).map((t) => ({
    schema: t.table.schema,
    table: t.table.name,
    label: `${t.table.schema}.${t.table.name}`,
    value: `${t.table.schema}.${t.table.name}`,
  }));

  const selectedLabel = schema && table ? `${schema}.${table}` : null;

  return (
    <Combobox
      options={tables}
      value={selectedLabel}
      placeholder="Select table..."
      searchPlaceholder="Search table..."
      emptyText="No table found."
      popoverContentClassName="w-80"
      onChange={(value) => {
        const found = tables.find((t) => t.value === value);
        if (found) {
          onChange({ schema: found.schema, table: found.table });
        }
      }}
    />
  );
}
