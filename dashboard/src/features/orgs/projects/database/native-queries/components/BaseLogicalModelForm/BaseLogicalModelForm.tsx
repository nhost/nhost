import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  type BaseLogicalModelFormProps,
  createLogicalModelFormSchema,
  defaultValues,
} from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm/BaseLogicalModelFormTypes';
import { LogicalModelFieldsSection } from '@/features/orgs/projects/database/native-queries/components/LogicalModelFieldsSection';
import type { LogicalModelFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import { createEmptyTypeNode } from '@/features/orgs/projects/database/native-queries/utils/createEmptyTypeNode';
import { cn } from '@/lib/utils';

export default function BaseLogicalModelForm({
  values = defaultValues,
  originalName,
  logicalModelNames,
  isPending,
  onSubmit,
  onCancel,
  onDirtyChange,
  isDrawer = false,
}: BaseLogicalModelFormProps) {
  const form = useForm<LogicalModelFormValues>({
    resolver: zodResolver(createLogicalModelFormSchema()),
    defaultValues: values,
    reValidateMode: 'onSubmit',
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'fields',
  });
  const watchedFields = useWatch({ control: form.control, name: 'fields' });
  const { isDirty } = form.formState;

  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { isDirty: true },
      callback: ({ isDirty: nextIsDirty }) => {
        onDirtyChange?.(Boolean(nextIsDirty));
      },
    });
    return () => {
      unsubscribe();
      onDirtyChange?.(false);
    };
  }, [form, onDirtyChange]);

  return (
    <form
      className={
        isDrawer
          ? 'box flex min-h-0 flex-auto flex-col content-between overflow-hidden border-t'
          : 'flex min-h-0 flex-1 flex-col'
      }
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className={cn('shrink-0 space-y-5', isDrawer && 'px-6 pt-4')}>
        <div className="space-y-2">
          <Label htmlFor="logical-model-name">Name</Label>
          <Input
            id="logical-model-name"
            placeholder="Logical model name"
            className="max-w-md"
            {...form.register('name')}
          />
          {form.formState.errors.name && (
            <p className="text-destructive text-sm">
              {form.formState.errors.name.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="logical-model-description">Description</Label>
          <Input
            id="logical-model-description"
            placeholder="Optional logical model description"
            className="max-w-md"
            {...form.register('description')}
          />
        </div>
      </div>

      <LogicalModelFieldsSection
        form={form}
        fields={fields}
        watchedFields={watchedFields}
        logicalModelNames={logicalModelNames}
        className={cn(isDrawer && 'px-6 pb-4')}
        onAdd={() =>
          append({ name: '', type: createEmptyTypeNode(), description: '' })
        }
        onRemove={remove}
      />

      <div
        className={
          isDrawer
            ? 'grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t p-2'
            : 'flex shrink-0 justify-end gap-2 border-t pt-4'
        }
      >
        <Button
          type="button"
          variant={isDrawer ? 'ghost' : 'outline'}
          className={cn(isDrawer && 'text-foreground')}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <ButtonWithLoading
          type="submit"
          loading={isPending}
          disabled={Boolean(originalName) && !isDirty}
        >
          {originalName ? 'Save' : 'Create'}
        </ButtonWithLoading>
      </div>
    </form>
  );
}
