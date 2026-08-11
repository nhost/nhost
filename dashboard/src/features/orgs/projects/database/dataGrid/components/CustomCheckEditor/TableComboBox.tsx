import { Combobox } from '@/components/ui/v3/combobox';
import { useExportMetadata } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import type { HasuraMetadataTable } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

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
  const { data: metadataTables } = useExportMetadata((data) => {
    const source = data.metadata.sources?.find((s) => s.name === 'default');
    return (source?.tables ?? []) as unknown as HasuraMetadataTable[];
  });

  const tables = (metadataTables ?? []).map((t) => ({
    schema: t.table.schema,
    table: t.table.name,
    label: `${t.table.schema}.${t.table.name}`,
    value: `${t.table.schema}.${t.table.name}`,
  }));

  const selectedLabel = schema && table ? `${schema}.${table}` : null;

  return (
    <Combobox
      className="w-72"
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
