import { useFormContext, useWatch } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { BaseForeignKeySchemaValues } from './BaseForeignKeyForm';

export default function ReferencedKeySelect() {
  const { control, setValue } = useFormContext<BaseForeignKeySchemaValues>();
  const referencedSchema = useWatch({ name: 'referencedSchema' });
  const referencedTable = useWatch({ name: 'referencedTable' });

  const { data: tableData, status } = useTableSchemaQuery(
    [`${referencedSchema}.${referencedTable}`],
    {
      schema: referencedSchema,
      table: referencedTable,
      queryOptions: { enabled: !!referencedSchema && !!referencedTable },
    },
  );

  const candidateKeys = tableData?.candidateKeys ?? [];

  const helperText =
    referencedSchema &&
    referencedTable &&
    !candidateKeys.length &&
    status === 'success'
      ? `There are no primary or unique keys in the ${referencedSchema}.${referencedTable} table.`
      : 'Only the primary and unique keys of the referenced table are listed here.';

  return (
    <FormSelect
      control={control}
      name="referencedKeyName"
      label="Referenced key"
      placeholder="Select a primary or unique key"
      disabled={
        !referencedSchema || !referencedTable || candidateKeys.length === 0
      }
      helperText={helperText}
      helperTextClassName="text-xs break-normal"
      contentClassName="z-[1400]"
      containerClassName="min-w-0"
      className="border-border [&>span]:line-clamp-none [&>span]:min-w-0 [&>span]:truncate"
      onChange={(value) => {
        const candidate = candidateKeys.find(({ name }) => name === value);

        if (!candidate) {
          return;
        }

        setValue('referencedColumns', candidate.columns);
        setValue(
          'columns',
          candidate.columns.map(() => ''),
        );
      }}
    >
      {candidateKeys.map(({ name, isPrimary, columns }) => (
        <SelectItem value={name} key={name}>
          {`${isPrimary ? 'PRIMARY KEY' : 'UNIQUE'} ${name} (${columns.join(', ')})`}
        </SelectItem>
      ))}
    </FormSelect>
  );
}
