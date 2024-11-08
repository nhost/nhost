import type { ControlledSelectProps } from '@/components/form/ControlledSelect';
import { ControlledSelect } from '@/components/form/ControlledSelect';
import { Option } from '@/components/ui/v2/Option';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';
import type { BaseForeignKeyFormValues } from './BaseForeignKeyForm';

export interface ReferencedSchemaSelectProps
  extends PropsWithoutRef<ControlledSelectProps> {
  /**
   * Available schemas in the database.
   */
  options: NormalizedQueryDataRow[];
}

function ReferencedSchemaSelect(
  { options, ...props }: ReferencedSchemaSelectProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const { setValue } = useFormContext<BaseForeignKeyFormValues>();
  const { errors } = useFormState({ name: 'referencedSchema' });

  const availableSchemas = options.map(
    ({ schema_name: schemaName }) => schemaName,
  );

  return (
    <ControlledSelect
      {...props}
      ref={ref}
      id="referencedSchema"
      name="referencedSchema"
      label="Schema"
      fullWidth
      placeholder="Select a schema"
      hideEmptyHelperText
      error={Boolean(errors.referencedSchema)}
      helperText={
        typeof errors.referencedSchema?.message === 'string'
          ? errors.referencedSchema?.message
          : ''
      }
      onChange={() => {
        setValue('referencedTable', null);
        setValue('referencedColumn', null);
      }}
    >
      {availableSchemas.map((name) => (
        <Option value={name} key={name}>
          {name}
        </Option>
      ))}
    </ControlledSelect>
  );
}

export default forwardRef(ReferencedSchemaSelect);
