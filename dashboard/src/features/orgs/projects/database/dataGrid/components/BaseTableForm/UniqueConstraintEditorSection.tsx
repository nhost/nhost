import { Plus } from 'lucide-react';
import {
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';
import { twMerge } from 'tailwind-merge';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import { createConstraintFormId } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/formReferences';
import UniqueConstraintDialogForm from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/UniqueConstraintDialogForm';
import UniqueConstraintEditorRow from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/UniqueConstraintEditorRow';
import { haveUniqueSuppliedConstraintNames } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/uniqueConstraintValidation';
import type {
  DatabaseColumn,
  FormUniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

function ConstraintErrorMessage() {
  const { errors } = useFormState({ name: 'uniqueConstraints' });
  const error = errors.uniqueConstraints;
  const message =
    typeof error?.message === 'string'
      ? error.message
      : typeof error?.root?.message === 'string'
        ? error.root.message
        : undefined;

  return message ? (
    <p className="font-medium text-destructive text-sm">{message}</p>
  ) : null;
}

export default function UniqueConstraintEditorSection() {
  const { openDialog } = useDialog();
  const { control, getValues } = useFormContext();
  const { fields, append, remove, update } = useFieldArray({
    control,
    name: 'uniqueConstraints',
    keyName: 'fieldId',
  });
  const tableName = (useWatch({ name: 'name' }) ?? '') as string;
  const columns = (useWatch({ name: 'columns' }) ?? []) as DatabaseColumn[];
  const constraints = (useWatch({ name: 'uniqueConstraints' }) ??
    []) as FormUniqueConstraint[];
  const availableColumns = columns.filter(({ formReference }) => formReference);

  function validateSiblingName(values: FormUniqueConstraint) {
    const currentConstraints = (getValues('uniqueConstraints') ??
      []) as FormUniqueConstraint[];
    const siblings = currentConstraints.filter(({ id }) => id !== values.id);

    if (!haveUniqueSuppliedConstraintNames([...siblings, values])) {
      throw new Error(
        'A UNIQUE constraint with this name already exists. Choose a different name.',
      );
    }
  }

  function openConstraintDialog(
    defaultValues: FormUniqueConstraint,
    constraintIndex?: number,
  ) {
    const isEditing = constraintIndex !== undefined;

    openDialog({
      title: (
        <span className="grid grid-flow-row">
          <span>
            {isEditing ? 'Edit Unique Constraint' : 'Add a Unique Constraint'}
          </span>
          <span className="text-muted-foreground text-sm">
            UNIQUE constraints may contain one or more columns. Column order is
            preserved.
          </span>
        </span>
      ),
      props: {
        PaperProps: { className: 'max-w-xl w-full overflow-hidden' },
      },
      component: (
        <UniqueConstraintDialogForm
          defaultValues={{
            ...defaultValues,
            columnReferences: [...defaultValues.columnReferences],
          }}
          availableColumns={availableColumns}
          tableName={tableName}
          submitButtonText={isEditing ? 'Save' : 'Add'}
          onSubmit={(values) => {
            validateSiblingName(values);

            if (constraintIndex === undefined) {
              append(values);
              return;
            }

            update(constraintIndex, values);
          }}
        />
      ),
    });
  }

  return (
    <div className="grid grid-flow-row gap-2 px-6">
      {fields.map((field, constraintIndex) => (
        <UniqueConstraintEditorRow
          key={field.fieldId}
          index={constraintIndex}
          onEdit={() => {
            const constraint = constraints[constraintIndex];
            if (constraint) {
              openConstraintDialog(constraint, constraintIndex);
            }
          }}
          onDelete={() => remove(constraintIndex)}
        />
      ))}

      <ConstraintErrorMessage />

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={twMerge(
          'mt-1 gap-2 rounded-sm+ py-2 text-primary hover:text-primary',
          fields.length === 0 && 'border border-input',
          fields.length > 0 && 'justify-self-start',
        )}
        disabled={availableColumns.length === 0}
        onClick={() =>
          openConstraintDialog({
            id: createConstraintFormId(),
            name: '',
            columnReferences: [],
          })
        }
      >
        <Plus className="h-4 w-4" />
        Add Unique Constraint
      </Button>
    </div>
  );
}
