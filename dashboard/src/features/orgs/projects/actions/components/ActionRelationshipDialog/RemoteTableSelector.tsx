import { useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormCombobox } from '@/components/form/FormCombobox';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import { useGetDataSources } from '@/features/orgs/projects/common/hooks/useGetDataSources';
import { useMetadataTables } from '@/features/orgs/projects/common/hooks/useMetadataTables';
import type { ActionRelationshipFormValues } from './ActionRelationshipFormTypes';

export default function RemoteTableSelector() {
  const { control, watch, setValue } =
    useFormContext<ActionRelationshipFormValues>();

  const { data: dataSources } = useGetDataSources();
  const allTables = useMetadataTables();

  const selectedSource = watch('source');
  const selectedSchema = watch('schema');

  const sourceOptions = useMemo(
    () => [...(dataSources ?? [])].sort((a, b) => a.localeCompare(b)),
    [dataSources],
  );

  const schemaOptions = useMemo(() => {
    const schemas = new Set<string>();
    allTables.forEach((table) => {
      if (table.source === selectedSource) {
        schemas.add(table.schema);
      }
    });
    return [...schemas].sort((a, b) => a.localeCompare(b));
  }, [allTables, selectedSource]);

  const tableOptions = useMemo(
    () =>
      allTables
        .filter(
          (table) =>
            table.source === selectedSource && table.schema === selectedSchema,
        )
        .map((table) => table.table)
        .sort((a, b) => a.localeCompare(b))
        .map((name) => ({ label: name, value: name })),
    [allTables, selectedSource, selectedSchema],
  );

  return (
    <div className="grid gap-4 rounded-md border p-4 sm:grid-cols-3">
      <FormSelect
        control={control}
        name="source"
        label="Source"
        placeholder="Select source"
        transform={{
          in: (storedValue: string) => storedValue,
          out: (selectedValue: string) => {
            setValue('schema', '', { shouldDirty: true });
            setValue('table', '', { shouldDirty: true });
            return selectedValue;
          },
        }}
      >
        {sourceOptions.map((source) => (
          <SelectItem key={source} value={source}>
            {source}
          </SelectItem>
        ))}
        {sourceOptions.length === 0 && (
          <SelectItem disabled value="__no-sources">
            No databases available
          </SelectItem>
        )}
      </FormSelect>

      <FormSelect
        control={control}
        name="schema"
        label="Schema"
        placeholder="Select schema"
        disabled={!selectedSource}
        transform={{
          in: (storedValue: string) => storedValue,
          out: (selectedValue: string) => {
            setValue('table', '', { shouldDirty: true });
            return selectedValue;
          },
        }}
      >
        {schemaOptions.map((schema) => (
          <SelectItem key={schema} value={schema}>
            {schema}
          </SelectItem>
        ))}
        {schemaOptions.length === 0 && (
          <SelectItem disabled value="__no-schemas">
            No schemas available
          </SelectItem>
        )}
      </FormSelect>

      <FormCombobox
        control={control}
        name="table"
        label="Table"
        placeholder="Select table"
        searchPlaceholder="Search table..."
        emptyText="No tables found."
        disabled={!selectedSchema}
        options={tableOptions}
      />
    </div>
  );
}
