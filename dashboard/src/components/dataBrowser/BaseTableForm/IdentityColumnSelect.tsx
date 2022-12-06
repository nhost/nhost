import ControlledSelect from '@/components/common/ControlledSelect';
import type { ColumnType, DatabaseColumn } from '@/types/dataBrowser';
import Option from '@/ui/v2/Option';
import { identityTypes } from '@/utils/dataBrowser/postgresqlConstants';
import { useMemo } from 'react';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';
import type { BaseTableFormValues } from './BaseTableForm';

const identityTypesMap = identityTypes.reduce(
  (map, type) => map.set(type, type),
  new Map<string, ColumnType>(),
);

export default function IdentityColumnSelect() {
  const { setValue } = useFormContext<BaseTableFormValues>();
  const { errors } = useFormState({ name: 'identityColumnIndex' });
  const columns: DatabaseColumn[] = useWatch({ name: 'columns' });

  // List of columns that can be used as an identity column
  const identityCandidateColumns = useMemo(
    () =>
      (columns || [])
        .map((column, index) => ({
          label: column.name,
          type: column.type,
          value: column.name,
          id: index,
        }))
        .filter((column) => identityTypesMap.has(column.type?.value)),
    [columns],
  );

  if (!identityCandidateColumns.length) {
    return null;
  }

  return (
    <ControlledSelect
      id="identityColumnIndex"
      name="identityColumnIndex"
      label="Identity"
      fullWidth
      className="col-span-8 py-3"
      variant="inline"
      placeholder="Select a column"
      hideEmptyHelperText
      error={Boolean(errors.identityColumnIndex)}
      helperText={
        typeof errors.identityColumnIndex?.message === 'string'
          ? errors.identityColumnIndex?.message
          : ''
      }
      onChange={(_event, columnIndex) => {
        if (columnIndex === '') {
          setValue('identityColumnIndex', null);
        }
      }}
    >
      <Option value="" className="italic">
        --
      </Option>

      {identityCandidateColumns.map(({ label, id }) => (
        <Option value={id} key={id}>
          {label}
        </Option>
      ))}
    </ControlledSelect>
  );
}
