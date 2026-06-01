import { useFormContext } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { BaseForeignKeySchemaValues } from './BaseForeignKeyForm';

export interface ReferencedSchemaSelectProps {
  /**
   * Available schemas in the database.
   */
  options: NormalizedQueryDataRow[];
  /**
   * Determines whether the select should be focused on mount.
   */
  autoFocus?: boolean;
}

export default function ReferencedSchemaSelect({
  options,
  autoFocus,
}: ReferencedSchemaSelectProps) {
  const { control, setValue } = useFormContext<BaseForeignKeySchemaValues>();

  const availableSchemas = options.map(
    ({ schema_name: schemaName }) => schemaName,
  );

  return (
    <FormSelect
      control={control}
      name="referencedSchema"
      label="Schema"
      placeholder="Select a schema"
      autoFocus={autoFocus}
      contentClassName="z-[1400]"
      transform={{
        in: (value: string) => value ?? '',
        out: (value: string) => {
          setValue('referencedTable', '');
          setValue('referencedColumn', '');
          return value;
        },
      }}
    >
      {availableSchemas.map((name) => (
        <SelectItem value={name} key={name}>
          {name}
        </SelectItem>
      ))}
    </FormSelect>
  );
}
