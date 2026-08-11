import { useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { FormSelect } from '@/components/form/FormSelect';
import { SelectItem } from '@/components/ui/v3/select';
import type {
  ColumnType,
  DatabaseColumn,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { identityTypes } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import type { BaseTableFormValues } from './BaseTableForm';

const identityTypesMap = identityTypes.reduce(
  (map, type) => map.set(type, type),
  new Map<string, ColumnType>(),
);

const NONE_VALUE = '__none__';

const identityColumnTransform = {
  in: (value: number | null | undefined) =>
    value === null || value === undefined ? NONE_VALUE : String(value),
  out: (value: string) =>
    value === NONE_VALUE ? null : Number.parseInt(value, 10),
};

export default function IdentityColumnSelect() {
  const { control } = useFormContext<BaseTableFormValues>();
  const columns: DatabaseColumn[] = useWatch({ name: 'columns' });

  const identityCandidateColumns = useMemo(
    () =>
      (columns || [])
        .map((column, index) => ({
          label: column.name,
          type: column.type,
          value: column.name,
          id: index,
        }))
        .filter((column) => !!column.type && identityTypesMap.has(column.type)),
    [columns],
  );

  if (!identityCandidateColumns.length) {
    return null;
  }

  return (
    <FormSelect
      control={control}
      name="identityColumnIndex"
      label="Identity"
      placeholder="Select a column"
      inline
      containerClassName="col-span-8 py-3"
      transform={identityColumnTransform}
    >
      <SelectItem value={NONE_VALUE} className="italic">
        --
      </SelectItem>
      {identityCandidateColumns.map(({ label, id }) => (
        <SelectItem value={String(id)} key={id}>
          {label}
        </SelectItem>
      ))}
    </FormSelect>
  );
}
