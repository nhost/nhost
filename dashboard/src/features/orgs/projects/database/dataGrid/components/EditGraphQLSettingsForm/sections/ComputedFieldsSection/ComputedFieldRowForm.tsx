import { zodResolver } from '@hookform/resolvers/zod';
import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { useComputedFieldDependents } from '@/features/orgs/projects/database/dataGrid/hooks/useComputedFieldDependents';
import { useComputedFieldMetadataMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useComputedFieldMetadataMutation';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import type {
  ComputedFieldItem,
  QualifiedTable,
} from '@/utils/hasura-api/generated/schemas';
import ComputedFieldFormFields from './ComputedFieldFormFields';
import {
  COMPUTED_FIELDS_DIRTY_SOURCE_ID,
  type ComputedFieldFormValues,
  computedFieldItemToFormValues,
  computedFieldValidationSchema,
  formValuesToAddComputedFieldArgs,
} from './computedFieldFormTypes';

export interface ComputedFieldRowFormProps {
  field: ComputedFieldItem;
  table: QualifiedTable;
  source: string;
  functions: PostgresFunction[];
  schemas: string[];
  isFunctionsLoading?: boolean;
  isSchemasLoading?: boolean;
  disabled?: boolean;
  /**
   * Collapse the row after a successful save. Unguarded — there are no unsaved
   * changes left at this point.
   */
  onClose: () => void;
  /**
   * Request to close the editor from the Cancel button. The owning row applies
   * the unsaved-changes guard, so this form stays unaware of the dialog.
   */
  onCancel: () => void;
  /**
   * Report this form's dirty state to the owning row so it can guard the
   * Cancel button and chevron-collapse. Drawer-level dirty registration is
   * handled by this form directly via `setDirtySource`.
   */
  onDirtyChange: (dirty: boolean) => void;
}

export default function ComputedFieldRowForm({
  field,
  table,
  source,
  functions,
  schemas,
  isFunctionsLoading,
  isSchemasLoading,
  disabled,
  onClose,
  onCancel,
  onDirtyChange,
}: ComputedFieldRowFormProps) {
  const { setDirtySource } = useDialog();

  const { mutateAsync: editComputedField } = useComputedFieldMetadataMutation({
    type: 'edit',
  });

  const { data: dependentRoles = [] } = useComputedFieldDependents({
    table,
    dataSource: source,
    computedFieldName: field.name,
  });

  const form = useForm<ComputedFieldFormValues>({
    defaultValues: computedFieldItemToFormValues(field),
    resolver: zodResolver(computedFieldValidationSchema),
  });

  const { isSubmitting } = form.formState;

  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { isDirty: true },
      callback: ({ isDirty }) => {
        const dirty = Boolean(isDirty);
        setDirtySource(COMPUTED_FIELDS_DIRTY_SOURCE_ID, dirty);
        onDirtyChange(dirty);
      },
    });
    return () => {
      unsubscribe();
      setDirtySource(COMPUTED_FIELDS_DIRTY_SOURCE_ID, false);
      onDirtyChange(false);
    };
  }, [form, setDirtySource, onDirtyChange]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const args = formValuesToAddComputedFieldArgs(values, table, source);

    await execPromiseWithErrorToast(
      () => editComputedField({ args, original: field }),
      {
        loadingMessage: 'Updating computed field...',
        successMessage: 'Computed field updated successfully.',
        errorMessage: 'Failed to update computed field.',
      },
    );

    onClose();
  });

  return (
    <Form {...form}>
      <form
        onSubmit={handleSubmit}
        className={cn('grid grid-cols-1 gap-6 bg-muted/30 px-6 py-6')}
      >
        <ComputedFieldFormFields
          functions={functions}
          schemas={schemas}
          table={table}
          isFunctionsLoading={isFunctionsLoading}
          isSchemasLoading={isSchemasLoading}
          disabled={disabled || isSubmitting}
        />
        <div className="flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <div className="flex min-w-0 items-center gap-3">
            {dependentRoles.length > 0 && (
              <div className="flex min-w-0 items-center gap-2">
                <TriangleAlert className="size-4 shrink-0 text-amber-500" />
                <p className="text-pretty text-muted-foreground text-sm">
                  Saving will remove select permissions for:{' '}
                  <span className="font-medium text-foreground">
                    {dependentRoles.join(', ')}
                  </span>
                </p>
              </div>
            )}
            <ButtonWithLoading
              type="submit"
              loading={isSubmitting}
              disabled={disabled}
              className="text-white"
            >
              Save
            </ButtonWithLoading>
          </div>
        </div>
      </form>
    </Form>
  );
}
