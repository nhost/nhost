import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Trash2 } from 'lucide-react';
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
import type {
  LogicalModelFieldNode,
  LogicalModelTypeNode,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import { createEmptyTypeNode } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';

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

export interface LogicalModelFormValues {
  source: string;
  name: string;
  fields: LogicalModelFieldNode[];
}

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
      fields: z
        .array(
          z.object({
            name: z.string().trim().min(1, 'Field name is required.'),
            type: typeSchema,
          }),
        )
        .min(1, 'Add at least one field.'),
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
  fields: [{ name: '', type: createEmptyTypeNode() }],
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

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="grid gap-2 sm:grid-cols-[9rem_1fr_auto]">
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

        {value.kind !== 'array' && <div />}

        <div className="flex items-center gap-2 text-sm">
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
  onCancel: VoidFunction;
  cancelLabel?: string;
  nameInputAutoFocus?: boolean;
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
  cancelLabel = 'Cancel',
  nameInputAutoFocus = false,
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetToken intentionally forces a form reset.
  useEffect(() => {
    reset(values);
  }, [reset, resetToken, values]);

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="shrink-0 space-y-5">
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

        <div className="flex items-center justify-between pt-5">
          <Label>Fields</Label>
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ name: '', type: createEmptyTypeNode() })}
          >
            <Plus className="mr-2 h-4 w-4" /> Add field
          </Button>
        </div>
      </div>

      <div className="relative mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 pb-4">
        {fields.map((field, index) => (
            <div key={field.id} className="space-y-2 rounded-md bg-muted p-3">
              <div className="flex gap-2">
                <Input
                  aria-label={`Field ${index + 1} name`}
                  placeholder="Field name"
                  {...form.register(`fields.${index}.name`)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove field ${index + 1}`}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              {form.formState.errors.fields?.[index]?.name && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.fields[index]?.name?.message}
                </p>
              )}
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
            </div>
          ))}
          {typeof form.formState.errors.fields?.message === 'string' && (
            <p className="text-destructive text-sm">
              {form.formState.errors.fields.message}
            </p>
          )}
      </div>

      <div className="flex shrink-0 justify-end gap-2 border-t pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <ButtonWithLoading type="submit" loading={isPending}>
          Save logical model
        </ButtonWithLoading>
      </div>
    </form>
  );
}
