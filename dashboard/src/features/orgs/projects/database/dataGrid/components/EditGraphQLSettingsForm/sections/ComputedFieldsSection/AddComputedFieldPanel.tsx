import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { useComputedFieldMetadataMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useComputedFieldMetadataMutation';
import type { PostgresFunction } from '@/features/orgs/projects/database/dataGrid/hooks/usePostgresFunctionsQuery';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { QualifiedTable } from '@/utils/hasura-api/generated/schemas';
import ComputedFieldFormFields from './ComputedFieldFormFields';
import {
  COMPUTED_FIELDS_DIRTY_SOURCE_ID,
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
}: AddComputedFieldPanelProps) {
  const { setDirtySource, openDirtyConfirmation } = useDialog();

  const { mutateAsync: createComputedField } = useComputedFieldMetadataMutation(
    { type: 'add' },
  );

  const form = useForm<ComputedFieldFormValues>({
    defaultValues: defaultComputedFieldValues,
    resolver: zodResolver(computedFieldValidationSchema),
  });

  const { isSubmitting } = form.formState;

  const isDirtyRef = useRef(false);

  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { isDirty: true },
      callback: ({ isDirty }) => {
        const dirty = Boolean(isDirty);
        isDirtyRef.current = dirty;
        setDirtySource(COMPUTED_FIELDS_DIRTY_SOURCE_ID, dirty);
      },
    });
    return () => {
      unsubscribe();
      setDirtySource(COMPUTED_FIELDS_DIRTY_SOURCE_ID, false);
    };
  }, [form, setDirtySource]);

  const handleCancel = () => {
    if (isDirtyRef.current) {
      openDirtyConfirmation({
        props: { onPrimaryAction: onClose },
      });
      return;
    }
    onClose();
  };

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
              onClick={handleCancel}
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
