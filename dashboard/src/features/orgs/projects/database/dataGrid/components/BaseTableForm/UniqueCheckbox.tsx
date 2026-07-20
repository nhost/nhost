import { useFormContext, useWatch } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { Checkbox } from '@/components/ui/v3/checkbox';
import type { FieldArrayInputProps } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/ColumnEditorRow/ColumnEditorRow';
import { createConstraintFormId } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/formReferences';
import type {
  DatabaseColumn,
  FormUniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export function UniqueCheckbox({ index }: FieldArrayInputProps) {
  const { openAlertDialog } = useDialog();
  const { getValues, setValue } = useFormContext();
  const columns = useWatch({ name: 'columns' }) as DatabaseColumn[];
  const uniqueConstraints = (useWatch({ name: 'uniqueConstraints' }) ??
    []) as FormUniqueConstraint[];
  const primaryKeyIndices = (useWatch({ name: 'primaryKeyIndices' }) ??
    []) as string[];
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const column = columns[index];
  const columnReference = column?.formReference;
  const singletonConstraints = uniqueConstraints.filter(
    ({ columnReferences }) =>
      columnReferences.length === 1 && columnReferences[0] === columnReference,
  );
  const checked = singletonConstraints.length > 0;
  const disabled =
    column?.isGenerated ||
    identityColumnIndex === index ||
    primaryKeyIndices.includes(`${index}`);

  const removeSingletonConstraints = () => {
    const currentConstraints = (getValues('uniqueConstraints') ??
      []) as FormUniqueConstraint[];
    setValue(
      'uniqueConstraints',
      currentConstraints.filter(
        ({ columnReferences }) =>
          columnReferences.length !== 1 ||
          columnReferences[0] !== columnReference,
      ),
      { shouldDirty: true, shouldValidate: true },
    );
    setValue(`columns.${index}.isUnique`, false, { shouldDirty: true });
  };

  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      aria-label="Unique"
      data-testid={`columns.${index}.isUnique`}
      onCheckedChange={(nextChecked) => {
        if (nextChecked && !checked && columnReference) {
          setValue(
            'uniqueConstraints',
            [
              ...uniqueConstraints,
              {
                id: createConstraintFormId(),
                columnReferences: [columnReference],
              },
            ],
            { shouldDirty: true, shouldValidate: true },
          );
          setValue(`columns.${index}.isUnique`, true, { shouldDirty: true });
          return;
        }

        if (!nextChecked && checked) {
          openAlertDialog({
            title: 'Remove unique constraints?',
            payload:
              singletonConstraints.length === 1
                ? 'This removes the UNIQUE constraint for this column.'
                : `This removes all ${singletonConstraints.length} singleton UNIQUE constraints for this column.`,
            props: {
              primaryButtonText: 'Remove',
              primaryButtonColor: 'error',
              onPrimaryAction: removeSingletonConstraints,
            },
          });
        }
      }}
    />
  );
}

export default UniqueCheckbox;
