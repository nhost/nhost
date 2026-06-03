import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, PencilIcon, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { Form } from '@/components/ui/v3/form';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
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
  type ComputedFieldFormValues,
  computedFieldItemToFormValues,
  computedFieldValidationSchema,
  formValuesToAddComputedFieldArgs,
} from './computedFieldFormTypes';
import DeleteComputedFieldAlertDialog from './DeleteComputedFieldAlertDialog';

export interface ComputedFieldRowProps {
  field: ComputedFieldItem;
  table: QualifiedTable;
  source: string;
  functions: PostgresFunction[];
  schemas: string[];
  isFunctionsLoading?: boolean;
  isSchemasLoading?: boolean;
  disabled?: boolean;
  isExpanded: boolean;
  onOpenChange: (open: boolean) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export default function ComputedFieldRow({
  field,
  table,
  source,
  functions,
  schemas,
  isFunctionsLoading,
  isSchemasLoading,
  disabled,
  isExpanded,
  onOpenChange,
  onDirtyChange,
}: ComputedFieldRowProps) {
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

  const { isSubmitting, isDirty } = form.formState;
  const isReportingDirty = isDirty && isExpanded;

  useEffect(() => {
    if (!isReportingDirty) {
      return undefined;
    }
    onDirtyChange?.(true);
    return () => onDirtyChange?.(false);
  }, [isReportingDirty, onDirtyChange]);

  useEffect(() => {
    if (isExpanded) {
      form.reset(computedFieldItemToFormValues(field));
    }
  }, [isExpanded, field, form]);

  const handleCancel = () => {
    form.reset(computedFieldItemToFormValues(field));
    onOpenChange(false);
  };

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

    onOpenChange(false);
  });

  const functionLabel = `${field.definition.function.schema}.${field.definition.function.name}`;

  return (
    <Collapsible
      open={isExpanded}
      onOpenChange={onOpenChange}
      disabled={disabled}
      className="overflow-hidden rounded-md"
    >
      <div
        className={cn(
          'grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,1fr)_5.25rem] items-center gap-3 px-4 py-3',
          isExpanded ? 'bg-muted/40' : 'bg-background',
        )}
      >
        <TextWithTooltip
          text={field.name}
          className="font-mono text-foreground text-sm"
          containerClassName="cursor-text"
        />
        <TextWithTooltip
          text={functionLabel}
          className="font-mono text-muted-foreground text-sm"
          containerClassName="cursor-text"
        />
        <TextWithTooltip
          text={field.comment || '—'}
          className="text-muted-foreground text-sm"
          containerClassName="cursor-text"
        />
        <div className="flex items-center gap-1">
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              aria-label={isExpanded ? 'Close editor' : 'Edit computed field'}
              data-testid={`edit-computed-field-${field.name}`}
            >
              {isExpanded ? (
                <ChevronDown className="size-4" />
              ) : (
                <PencilIcon className="size-4" />
              )}
            </Button>
          </CollapsibleTrigger>
          <DeleteComputedFieldAlertDialog
            field={field}
            table={table}
            source={source}
            disabled={disabled}
          />
        </div>
      </div>
      <CollapsibleContent>
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
                onClick={handleCancel}
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
      </CollapsibleContent>
    </Collapsible>
  );
}
