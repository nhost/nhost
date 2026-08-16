import { zodResolver } from '@hookform/resolvers/zod';
import {
  Controller,
  type UseFormReturn,
  useFieldArray,
  useForm,
  useWatch,
} from 'react-hook-form';
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
import { TypedFieldRow } from '@/features/orgs/projects/database/native-queries/components/TypedFieldRow';
import {
  TYPED_FIELDS_GRID_CLASS_NAMES,
  TypedFieldsSection,
} from '@/features/orgs/projects/database/native-queries/components/TypedFieldsSection';
import { useReportDirtyChange } from '@/features/orgs/projects/database/native-queries/hooks/useReportDirtyChange';
import type { LogicalModelFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelTrackArgs';
import type { LogicalModelTypeNode } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import { createEmptyTypeNode } from '@/features/orgs/projects/database/native-queries/utils/logicalModelType';
import { POSTGRES_TYPES } from '@/features/orgs/projects/database/native-queries/utils/postgresTypes';
import { getGraphQLIdentifierSchema } from '@/features/orgs/projects/database/utils/get-graphql-identifier-schema';
import { cn } from '@/lib/utils';

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

const logicalModelBaseSchema = z.object({
  source: z.string().trim().min(1, 'Select a data source.'),
  name: getGraphQLIdentifierSchema('Name', 'Name is required.'),
  description: z.string(),
  fields: z.array(
    z.object({
      name: getGraphQLIdentifierSchema('Field name', 'Field name is required.'),
      type: typeSchema,
      description: z.string(),
    }),
  ),
});

export const createLogicalModelFormSchema = (
  existingNames: string[],
  originalName?: string,
) =>
  logicalModelBaseSchema.superRefine((values, context) => {
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

function getErrorProperty(error: unknown, property: string): unknown {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  return (error as Record<string, unknown>)[property];
}

function getErrorMessage(error: unknown): string | undefined {
  const message = getErrorProperty(error, 'message');
  return typeof message === 'string' ? message : undefined;
}

function createTypeNodeForKind(
  kind: LogicalModelTypeNode['kind'],
  nullable: boolean,
): LogicalModelTypeNode {
  if (kind === 'scalar') {
    return { ...createEmptyTypeNode(), nullable };
  }

  if (kind === 'logical_model') {
    return { kind, logicalModel: '', nullable };
  }

  return { kind, item: createEmptyTypeNode(), nullable };
}

function getTypeNodeValueError(
  error: unknown,
  kind: LogicalModelTypeNode['kind'],
): string | undefined {
  if (kind === 'array') {
    return undefined;
  }

  const property = kind === 'scalar' ? 'scalar' : 'logicalModel';
  return (
    getErrorMessage(getErrorProperty(error, property)) ?? getErrorMessage(error)
  );
}

interface TypeNodeEditorProps {
  value: LogicalModelTypeNode;
  onChange: (value: LogicalModelTypeNode) => void;
  logicalModelNames: string[];
  idPrefix: string;
  pathLabel: string;
  error?: unknown;
}

function TypeNodeEditor({
  value,
  onChange,
  logicalModelNames,
  idPrefix,
  pathLabel,
  error,
}: TypeNodeEditorProps) {
  const nullableId = `${idPrefix}-nullable`;
  const valueError = getTypeNodeValueError(error, value.kind);
  const valueErrorId = valueError ? `${idPrefix}-error` : undefined;

  return (
    <>
      <div className="min-w-0">
        <Select
          value={value.kind}
          onValueChange={(kind: LogicalModelTypeNode['kind']) =>
            onChange(createTypeNodeForKind(kind, value.nullable))
          }
        >
          <SelectTrigger aria-label={`${pathLabel} kind`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="scalar">Scalar</SelectItem>
            <SelectItem value="logical_model">Logical model</SelectItem>
            <SelectItem value="array">Array</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 space-y-1">
        {value.kind === 'scalar' && (
          <FreeCombobox
            aria-label={`${pathLabel} scalar type`}
            aria-invalid={Boolean(valueError)}
            aria-describedby={valueErrorId}
            className="h-10"
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
            aria-label={`${pathLabel} logical model`}
            aria-invalid={Boolean(valueError)}
            aria-describedby={valueErrorId}
            className="h-10"
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

        {valueError && (
          <p id={valueErrorId} className="text-destructive text-sm">
            {valueError}
          </p>
        )}
      </div>

      <div className="flex h-10 items-center justify-center">
        <Checkbox
          id={nullableId}
          aria-label={`${pathLabel} nullable`}
          checked={value.nullable}
          onCheckedChange={(checked) =>
            onChange({ ...value, nullable: checked === true })
          }
        />
      </div>
    </>
  );
}

function TypeNodeContinuation({
  value,
  onChange,
  logicalModelNames,
  idPrefix,
  pathLabel,
  error,
}: TypeNodeEditorProps) {
  return (
    <div
      data-testid="field-item-group"
      className="border-border border-l-2 pl-4"
    >
      <p className="mb-2 font-medium text-muted-foreground text-xs">
        Item type
      </p>
      <div className="grid min-w-[23.5rem] grid-cols-[minmax(7rem,0.8fr)_minmax(10.5rem,1.25fr)_5rem] items-start gap-2">
        <TypeNodeEditor
          value={value}
          onChange={onChange}
          logicalModelNames={logicalModelNames}
          idPrefix={idPrefix}
          pathLabel={pathLabel}
          error={error}
        />
      </div>

      {value.kind === 'array' && (
        <div className="mt-3">
          <TypeNodeContinuation
            value={value.item}
            onChange={(item) => onChange({ ...value, item })}
            logicalModelNames={logicalModelNames}
            idPrefix={`${idPrefix}-item`}
            pathLabel={`${pathLabel} item`}
            error={getErrorProperty(error, 'item')}
          />
        </div>
      )}
    </div>
  );
}

interface LogicalModelFieldRowProps {
  index: number;
  value: LogicalModelTypeNode;
  descriptionValue?: string;
  nameError?: string;
  typeError?: unknown;
  logicalModelNames: string[];
  form: UseFormReturn<LogicalModelFormValues>;
  onRemove: VoidFunction;
}

function LogicalModelFieldRow({
  index,
  value,
  descriptionValue,
  nameError,
  typeError,
  logicalModelNames,
  form,
  onRemove,
}: LogicalModelFieldRowProps) {
  const idPrefix = `logical-model-field-${index + 1}-type`;
  const pathLabel = `Field ${index + 1}`;

  return (
    <TypedFieldRow
      noun="Field"
      index={index}
      nameInputProps={form.register(`fields.${index}.name`)}
      descriptionInputProps={form.register(`fields.${index}.description`)}
      descriptionValue={descriptionValue}
      nameError={nameError}
      onRemove={onRemove}
      typeEditor={
        <Controller
          control={form.control}
          name={`fields.${index}.type`}
          render={({ field: typeField, fieldState }) => (
            <TypeNodeEditor
              value={value ?? typeField.value}
              onChange={typeField.onChange}
              logicalModelNames={logicalModelNames}
              idPrefix={idPrefix}
              pathLabel={pathLabel}
              error={fieldState.error}
            />
          )}
        />
      }
      continuationRows={
        value.kind === 'array' ? (
          <div
            className={cn(
              'grid items-start gap-2 pt-1 pb-2',
              TYPED_FIELDS_GRID_CLASS_NAMES.field,
            )}
          >
            <div className="col-span-3 col-start-2 min-w-0">
              <TypeNodeContinuation
                value={value.item}
                onChange={(item) =>
                  form.setValue(
                    `fields.${index}.type`,
                    { ...value, item },
                    { shouldDirty: true, shouldValidate: true },
                  )
                }
                logicalModelNames={logicalModelNames}
                idPrefix={`${idPrefix}-item`}
                pathLabel={`${pathLabel} item`}
                error={getErrorProperty(typeError, 'item')}
              />
            </div>
          </div>
        ) : undefined
      }
    />
  );
}

export interface BaseLogicalModelFormProps {
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
  layout?: 'drawer' | 'embedded';
}

export default function BaseLogicalModelForm({
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
  layout = 'embedded',
}: BaseLogicalModelFormProps) {
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
  const { isDirty } = form.formState;
  const isDrawer = layout === 'drawer';

  useReportDirtyChange(isDirty, onDirtyChange);

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
        variant="field"
        className={cn(isDrawer && 'px-6 pb-4')}
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
          <LogicalModelFieldRow
            key={field.id}
            index={index}
            value={watchedFields[index]?.type ?? field.type}
            descriptionValue={watchedFields[index]?.description}
            nameError={form.formState.errors.fields?.[index]?.name?.message}
            typeError={form.formState.errors.fields?.[index]?.type}
            logicalModelNames={logicalModelNames}
            form={form}
            onRemove={() => remove(index)}
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
