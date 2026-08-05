import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Combobox } from '@/components/ui/v3/combobox';
import { FreeCombobox } from '@/components/ui/v3/free-combobox';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import TypedFieldRow from '@/features/orgs/projects/database/native-queries/components/TypedFieldRow';
import TypedFieldsSection from '@/features/orgs/projects/database/native-queries/components/TypedFieldsSection';
import type { LogicalModelFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelTrackArgs';
import type { LogicalModelTypeNode } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import { createEmptyTypeNode } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import { cn } from '@/lib/utils';

const POSTGRES_TYPES = [
  'bigint',
  'boolean',
  'date',
  'float8',
  'integer',
  'json',
  'jsonb',
  'numeric',
  'text',
  'timestamp',
  'timestamptz',
  'uuid',
] as const;

const typeSchema: z.ZodType<LogicalModelTypeNode> = z.lazy(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('scalar'),
      scalar: z.string().trim().min(1, 'Select or enter a scalar type.'),
      nullable: z.boolean(),
    }),
    z.object({
      kind: z.literal('logical_model'),
      logicalModel: z.string().trim().min(1, 'Select a logical model.'),
      nullable: z.boolean(),
    }),
    z.object({
      kind: z.literal('array'),
      item: typeSchema,
      nullable: z.boolean(),
    }),
  ]),
);

export const createLogicalModelFormSchema = (
  existingNames: string[],
  originalName?: string,
) =>
  z
    .object({
      source: z.string().trim().min(1, 'Select a data source.'),
      name: z.string().trim().min(1, 'Name is required.'),
      description: z.string(),
      fields: z.array(
        z.object({
          name: z.string().trim().min(1, 'Field name is required.'),
          type: typeSchema,
          description: z.string(),
        }),
      ),
    })
    .superRefine((values, context) => {
      if (values.name !== originalName && existingNames.includes(values.name)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['name'],
          message: 'A logical model with this name already exists.',
        });
      }

      const names = new Set<string>();
      values.fields.forEach((field, index) => {
        if (names.has(field.name)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['fields', index, 'name'],
            message: 'Field names must be unique.',
          });
        }
        names.add(field.name);
      });
    });

const defaultValues: LogicalModelFormValues = {
  source: 'default',
  name: '',
  description: '',
  fields: [{ name: '', type: createEmptyTypeNode(), description: '' }],
};

function getErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  const errorRecord = error as Record<string, unknown>;
  if (typeof errorRecord.message === 'string') {
    return errorRecord.message;
  }

  for (const nestedError of Object.values(errorRecord)) {
    const message = getErrorMessage(nestedError);
    if (message) {
      return message;
    }
  }

  return undefined;
}

interface TypeNodeEditorProps {
  value: LogicalModelTypeNode;
  onChange: (value: LogicalModelTypeNode) => void;
  logicalModelNames: string[];
  idPrefix: string;
  depth?: number;
}

function TypeNodeEditor({
  value,
  onChange,
  logicalModelNames,
  idPrefix,
  depth = 0,
}: TypeNodeEditorProps) {
  const nullableLabel =
    value.kind === 'array'
      ? 'Nullable array'
      : depth > 0
        ? 'Nullable items'
        : 'Nullable';
  const nullableId = `${idPrefix}-nullable`;
  const containerClassName =
    depth === 0 ? 'flex flex-col gap-2' : 'flex flex-col gap-2 border-l-2 pl-4';

  return (
    <div className={containerClassName}>
      <div className="grid gap-2 sm:grid-cols-[9rem_minmax(0,24rem)_auto]">
        <Select
          value={value.kind}
          onValueChange={(kind: LogicalModelTypeNode['kind']) => {
            if (kind === 'scalar') {
              onChange(createEmptyTypeNode());
            } else if (kind === 'logical_model') {
              onChange({ kind, logicalModel: '', nullable: true });
            } else {
              onChange({
                kind,
                item: createEmptyTypeNode(),
                nullable: true,
              });
            }
          }}
        >
          <SelectTrigger aria-label={`Type kind level ${depth}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scalar">Scalar</SelectItem>
            <SelectItem value="logical_model">Logical model</SelectItem>
            <SelectItem value="array">Array</SelectItem>
          </SelectContent>
        </Select>

        {value.kind === 'scalar' && (
          <FreeCombobox
            aria-label={`Scalar type level ${depth}`}
            className="h-10 max-w-sm"
            value={value.scalar || null}
            options={POSTGRES_TYPES.map((type) => ({
              label: type,
              value: type,
            }))}
            placeholder="Select or enter a type"
            searchPlaceholder="Search types..."
            onChange={(scalar) => onChange({ ...value, scalar })}
          />
        )}

        {value.kind === 'logical_model' && (
          <Combobox
            aria-label={`Logical model level ${depth}`}
            className="h-10 max-w-sm"
            value={value.logicalModel || null}
            options={logicalModelNames.map((name) => ({
              label: name,
              value: name,
            }))}
            placeholder="Select a logical model"
            searchPlaceholder="Search logical models..."
            onChange={(logicalModel) => onChange({ ...value, logicalModel })}
          />
        )}

        <div
          className={cn(
            'flex items-center gap-2 text-sm',
            value.kind !== 'array' && 'sm:pl-2',
          )}
        >
          <Checkbox
            id={nullableId}
            checked={value.nullable}
            onCheckedChange={(checked) =>
              onChange({ ...value, nullable: checked === true })
            }
          />
          <label htmlFor={nullableId}>{nullableLabel}</label>
        </div>
      </div>

      {value.kind === 'array' && (
        <TypeNodeEditor
          value={value.item}
          onChange={(item) => onChange({ ...value, item })}
          logicalModelNames={logicalModelNames}
          idPrefix={`${idPrefix}-item`}
          depth={depth + 1}
        />
      )}
    </div>
  );
}

interface LogicalModelFormProps {
  resetToken: string;
  values?: LogicalModelFormValues;
  existingNames: string[];
  originalName?: string;
  logicalModelNames: string[];
  sourceOptions: string[];
  sourceDisabled?: boolean;
  isPending: boolean;
  onSubmit: (values: LogicalModelFormValues) => Promise<void> | void;
  onCancel: (event?: unknown) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  cancelLabel?: string;
  nameInputAutoFocus?: boolean;
  layout?: 'drawer' | 'embedded';
}

export default function LogicalModelForm({
  resetToken,
  values = defaultValues,
  existingNames,
  originalName,
  logicalModelNames,
  sourceOptions,
  sourceDisabled = false,
  isPending,
  onSubmit,
  onCancel,
  onDirtyChange,
  cancelLabel = 'Cancel',
  nameInputAutoFocus = false,
  layout = 'embedded',
}: LogicalModelFormProps) {
  const form = useForm<LogicalModelFormValues>({
    resolver: zodResolver(
      createLogicalModelFormSchema(existingNames, originalName),
    ),
    defaultValues: values,
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'fields',
  });
  const watchedFields = useWatch({ control: form.control, name: 'fields' });
  const { reset } = form;
  const { isDirty } = form.formState;
  const isDrawer = layout === 'drawer';

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetToken intentionally forces a form reset.
  useEffect(() => {
    reset(values);
  }, [reset, resetToken, values]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => onDirtyChange?.(false);
  }, [isDirty, onDirtyChange]);

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
          <Label htmlFor="logical-model-source">Data Source</Label>
          <Controller
            control={form.control}
            name="source"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={sourceDisabled}
              >
                <SelectTrigger
                  id="logical-model-source"
                  className="min-w-[120px] max-w-60"
                  aria-label="Data Source"
                >
                  <SelectValue placeholder="Select a data source" />
                </SelectTrigger>
                <SelectContent>
                  {sourceOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.source && (
            <p className="text-destructive text-sm">
              {form.formState.errors.source.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="logical-model-name">Name</Label>
          <Input
            id="logical-model-name"
            autoFocus={nameInputAutoFocus}
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

      <TypedFieldsSection
        label="Fields"
        className={cn(isDrawer && 'px-6 pb-4')}
        addLabel="Add field"
        layout="contained"
        error={
          form.formState.errors.fields?.root?.message ??
          (typeof form.formState.errors.fields?.message === 'string'
            ? form.formState.errors.fields.message
            : undefined)
        }
        onAdd={() =>
          append({
            name: '',
            type: createEmptyTypeNode(),
            description: '',
          })
        }
      >
        {fields.map((field, index) => (
          <TypedFieldRow
            key={field.id}
            noun="Field"
            index={index}
            nameInputProps={form.register(`fields.${index}.name`)}
            descriptionInputProps={form.register(`fields.${index}.description`)}
            nameError={form.formState.errors.fields?.[index]?.name?.message}
            onRemove={() => remove(index)}
            typeEditor={
              <Controller
                control={form.control}
                name={`fields.${index}.type`}
                render={({ field: typeField, fieldState }) => {
                  const errorMessage = getErrorMessage(fieldState.error);

                  return (
                    <div className="space-y-1">
                      <TypeNodeEditor
                        value={watchedFields[index]?.type ?? typeField.value}
                        onChange={typeField.onChange}
                        logicalModelNames={logicalModelNames}
                        idPrefix={`logical-model-field-${index + 1}-type`}
                      />
                      {errorMessage && (
                        <p className="text-destructive text-sm">
                          {errorMessage}
                        </p>
                      )}
                    </div>
                  );
                }}
              />
            }
          />
        ))}
      </TypedFieldsSection>

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
          {cancelLabel}
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
