import { useFormContext } from 'react-hook-form';
import { Combobox } from '@/components/ui/v3/combobox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';

export default function TargetTableCombobox() {
  const form = useFormContext<DatabaseRelationshipFormValues>();

  const { data } = useDatabaseQuery(['default'], {
    dataSource: 'default',
  });

  const handleSelectTable = (table: { name: string; schema: string }) => {
    form.setValue('table', table, {
      shouldValidate: true,
      shouldDirty: true,
      shouldTouch: true,
    });

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
    <FormField
      control={form.control}
      name="table"
      render={({ field }) => {
        const selectedValue =
          field.value?.name && field.value?.schema
            ? `${field.value.schema}/${field.value.name}`
            : null;

        return (
          <FormItem className="flex flex-1 flex-col">
            <FormLabel>Target Table</FormLabel>
            <FormControl>
              <Combobox
                options={options}
                value={selectedValue}
                onChange={(value) => {
                  const matchedTable = tables.find(
                    (t) => `${t.value.schema}/${t.value.name}` === value,
                  );
                  if (matchedTable) {
                    handleSelectTable(matchedTable.value);
                  }
                }}
                onBlur={field.onBlur}
                placeholder="Select table"
                searchPlaceholder="Search target table..."
                emptyText="No target table found."
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        );
      }}
    />
  );
}
