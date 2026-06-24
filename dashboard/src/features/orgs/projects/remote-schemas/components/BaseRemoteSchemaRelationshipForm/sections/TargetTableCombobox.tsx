import { useFormContext } from 'react-hook-form';
import { FormCombobox } from '@/components/form/FormCombobox';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';

export default function TargetTableCombobox() {
  const form = useFormContext<DatabaseRelationshipFormValues>();

  const { data } = useDatabaseQuery(['default'], {
    dataSource: 'default',
  });

  const handleSelectTable = () => {
    if (form.getValues('fieldMapping').length > 0) {
      form.setValue(
        'fieldMapping',
        form.getValues('fieldMapping').map((field) => ({
          ...field,
          referenceColumn: '',
        })),
        {
          shouldValidate: true,
          shouldDirty: true,
          shouldTouch: true,
        },
      );
    }
  };

  const tables = (data?.tableLikeObjects ?? [])
    .flatMap((table) =>
      table.table_name && table.table_schema
        ? [
            {
              label: `default / ${table.table_schema} / ${table.table_name}`,
              value: {
                name: table.table_name,
                schema: table.table_schema,
              },
            },
          ]
        : [],
    )
    .sort((a, b) => a.label.localeCompare(b.label));

  const options = tables.map((table) => ({
    label: table.label,
    value: `${table.value.schema}/${table.value.name}`,
  }));

  return (
    <FormCombobox
      control={form.control}
      name="table"
      label="Target Table"
      placeholder="Select table"
      searchPlaceholder="Search target table..."
      emptyText="No target table found."
      options={options}
      transform={{
        in: (value) =>
          value?.name && value?.schema ? `${value.schema}/${value.name}` : '',
        out: (value) => {
          const matchedTable = tables.find(
            (t) => `${t.value.schema}/${t.value.name}` === value,
          );
          return matchedTable ? matchedTable.value : null;
        },
      }}
      onChange={handleSelectTable}
    />
  );
}
