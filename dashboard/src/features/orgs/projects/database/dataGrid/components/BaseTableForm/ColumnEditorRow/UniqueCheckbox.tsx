import { useFormContext, useWatch } from 'react-hook-form';
import { Checkbox } from '@/components/ui/v3/checkbox';
import type { BaseTableFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm';
import type { FieldArrayInputProps } from './ColumnEditorRow';

type UniqueKey = NonNullable<BaseTableFormValues['uniqueKeys']>[number];

export function UniqueCheckbox({ index }: FieldArrayInputProps) {
  const { setValue } = useFormContext<BaseTableFormValues>();
  const uniqueKeys: UniqueKey[] = useWatch({ name: 'uniqueKeys' }) ?? [];
  const uniqueIndexColumnIds: string[] =
    useWatch({ name: 'uniqueIndexColumnIds' }) ?? [];
  const primaryKeyIndices: string[] = useWatch({ name: 'primaryKeyIndices' });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const columnId = useWatch({ name: `columns.${index}.id` });
  const isGenerated = useWatch({ name: `columns.${index}.isGenerated` });

  const columnIndex = `${index}`;
  const isColumnKey = ({ columnIndices }: UniqueKey) =>
    columnIndices.length === 1 && columnIndices[0] === columnIndex;
  const hasUniqueKey = uniqueKeys.some(isColumnKey);
  const hasUniqueIndex =
    !hasUniqueKey && !!columnId && uniqueIndexColumnIds.includes(columnId);
  const isLocked =
    isGenerated ||
    identityColumnIndex === index ||
    primaryKeyIndices.includes(columnIndex);

  return (
    <Checkbox
      aria-label="Unique"
      data-testid={`columns.${index}.isUnique`}
      checked={hasUniqueKey || hasUniqueIndex}
      disabled={isLocked || hasUniqueIndex}
      onCheckedChange={(checked) =>
        setValue(
          'uniqueKeys',
          checked
            ? [...uniqueKeys, { columnIndices: [columnIndex] }]
            : uniqueKeys.filter((uniqueKey) => !isColumnKey(uniqueKey)),
          { shouldDirty: true },
        )
      }
    />
  );
}

export default UniqueCheckbox;
