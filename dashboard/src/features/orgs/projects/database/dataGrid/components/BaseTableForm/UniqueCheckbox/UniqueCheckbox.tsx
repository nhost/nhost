import { useFormContext, useWatch } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { Checkbox } from '@/components/ui/v3/checkbox';
import type { BaseTableFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/BaseTableForm';
import type { FieldArrayInputProps } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/ColumnEditorRow';
import type { ColumnFormReference } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { createConstraintFormId } from '@/features/orgs/projects/database/dataGrid/utils/formReferences';

function UniqueCheckbox({ index }: FieldArrayInputProps) {
  const { openAlertDialog } = useDialog();
  const { control, getValues, setValue } =
    useFormContext<BaseTableFormValues>();
  const columns = useWatch({ control, name: 'columns' });
  const uniqueConstraints =
    useWatch({ control, name: 'uniqueConstraints' }) ?? [];
  const primaryKeyIndices =
    useWatch({ control, name: 'primaryKeyIndices' }) ?? [];
  const identityColumnIndex = useWatch({
    control,
    name: 'identityColumnIndex',
  });
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

  const addSingletonConstraint = (reference: ColumnFormReference) => {
    setValue(
      'uniqueConstraints',
      [
        ...uniqueConstraints,
        { id: createConstraintFormId(), columnReferences: [reference] },
      ],
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const removeSingletonConstraints = () => {
    const currentConstraints = getValues('uniqueConstraints') ?? [];
    setValue(
      'uniqueConstraints',
      currentConstraints.filter(
        ({ columnReferences }) =>
          columnReferences.length !== 1 ||
          columnReferences[0] !== columnReference,
      ),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const confirmRemoveSingletonConstraints = () => {
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
  };

  return (
    <Checkbox
      checked={checked}
      disabled={disabled}
      aria-label="Unique"
      data-testid={`columns.${index}.isUnique`}
      onCheckedChange={(nextChecked) => {
        if (nextChecked && !checked && columnReference) {
          addSingletonConstraint(columnReference);
          return;
        }

        if (!nextChecked && checked) {
          confirmRemoveSingletonConstraints();
        }
      }}
    />
  );
}

export default UniqueCheckbox;
