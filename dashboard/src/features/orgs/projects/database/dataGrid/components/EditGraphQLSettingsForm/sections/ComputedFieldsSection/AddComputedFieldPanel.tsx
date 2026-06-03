import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { useComputedFieldMetadataMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useComputedFieldMetadataMutation';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';
import ComputedFieldFormFields from './ComputedFieldFormFields';
import {
  type ComputedFieldFormValues,
  computedFieldValidationSchema,
  defaultComputedFieldValues,
  formValuesToAddComputedFieldArgs,
} from './computedFieldFormTypes';

export interface AddComputedFieldPanelProps {
  table: QualifiedTable;
  source: string;
  functions: PostgresFunction[];
  schemas: string[];
  isFunctionsLoading?: boolean;
  isSchemasLoading?: boolean;
  disabled?: boolean;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function AddComputedFieldPanel({
  table,
  source,
  functions,
  schemas,
  isFunctionsLoading,
  isSchemasLoading,
  disabled,
  onClose,
  onDirtyChange,
}: AddComputedFieldPanelProps) {
  const { mutateAsync: createComputedField } = useComputedFieldMetadataMutation(
    { type: 'add' },
  );

  const form = useForm<ComputedFieldFormValues>({
    defaultValues: defaultComputedFieldValues,
    resolver: zodResolver(computedFieldValidationSchema),
  });

  const { isSubmitting, isDirty } = form.formState;

  useEffect(() => {
    if (!isDirty) {
      return undefined;
    }
    onDirtyChange?.(true);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const args = formValuesToAddComputedFieldArgs(values, table, source);

    await execPromiseWithErrorToast(() => createComputedField({ args }), {
      loadingMessage: 'Adding computed field...',
      successMessage: 'Computed field added successfully.',
      errorMessage: 'Failed to add computed field.',
    });

    onClose();
  });

  return (
    <div
      className="overflow-hidden rounded-md bg-muted/20"
      data-testid="add-computed-field-panel"
    >
      <div className="flex items-center justify-between bg-muted/40 px-4 py-2">
        <p className="font-medium text-sm">New field</p>
      </div>
      <Form {...form}>
        <form
          onSubmit={handleSubmit}
          className="grid grid-cols-1 gap-6 px-6 py-6"
        >
          <ComputedFieldFormFields
            functions={functions}
            schemas={schemas}
            table={table}
            isFunctionsLoading={isFunctionsLoading}
            isSchemasLoading={isSchemasLoading}
            disabled={disabled || isSubmitting}
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <ButtonWithLoading
              type="submit"
              loading={isSubmitting}
              disabled={disabled}
              className="text-white"
            >
              Add
            </ButtonWithLoading>
          </div>
        </form>
      </Form>
    </div>
  );
}
