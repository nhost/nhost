import { Controller, type UseFormReturn } from 'react-hook-form';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Combobox } from '@/components/ui/v3/combobox';
import { FreeCombobox } from '@/components/ui/v3/free-combobox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import {
  postgresTypeOptions,
  type TypeNodeError,
} from '@/features/orgs/projects/database/native-queries/components/BaseLogicalModelForm/BaseLogicalModelFormTypes';
import { TypedFieldRow } from '@/features/orgs/projects/database/native-queries/components/TypedFieldRow';
import {
  TYPED_FIELDS_GRID_CLASS_NAMES,
  TypedFieldsSection,
} from '@/features/orgs/projects/database/native-queries/components/TypedFieldsSection';
import type { LogicalModelTypeNode } from '@/features/orgs/projects/database/native-queries/types';
import type { LogicalModelFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildLogicalModelDTO';
import { createEmptyTypeNode } from '@/features/orgs/projects/database/native-queries/utils/createEmptyTypeNode';
import { cn } from '@/lib/utils';

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

function getTypeNodeErrorMessage(
  error: TypeNodeError | undefined,
  kind: LogicalModelTypeNode['kind'],
): string | undefined {
  if (kind === 'scalar') {
    return error?.scalar?.message ?? error?.message;
  }

  if (kind === 'logical_model') {
    return error?.logicalModel?.message ?? error?.message;
  }

  return undefined;
}

interface TypeNodeEditorProps {
  value: LogicalModelTypeNode;
  onChange: (value: LogicalModelTypeNode) => void;
  logicalModelNames: string[];
  idPrefix: string;
  pathLabel: string;
  error?: TypeNodeError;
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
  const valueError = getTypeNodeErrorMessage(error, value.kind);
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
            options={postgresTypeOptions}
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

function ArrayItemTypeEditor({
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
      <div className="grid min-w-[21rem] grid-cols-[minmax(7rem,0.8fr)_minmax(8rem,1fr)_5rem] items-start gap-2">
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
          <ArrayItemTypeEditor
            value={value.item}
            onChange={(item) => onChange({ ...value, item })}
            logicalModelNames={logicalModelNames}
            idPrefix={`${idPrefix}-item`}
            pathLabel={`${pathLabel} item`}
            error={error?.item}
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
  typeError?: TypeNodeError;
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
              <ArrayItemTypeEditor
                value={value.item}
                onChange={(item) =>
                  form.setValue(
                    `fields.${index}.type`,
                    { ...value, item },
                    { shouldDirty: true },
                  )
                }
                logicalModelNames={logicalModelNames}
                idPrefix={`${idPrefix}-item`}
                pathLabel={`${pathLabel} item`}
                error={typeError?.item}
              />
            </div>
          </div>
        ) : undefined
      }
    />
  );
}

export interface LogicalModelFieldsSectionProps {
  form: UseFormReturn<LogicalModelFormValues>;
  fields: { id: string; type: LogicalModelTypeNode }[];
  watchedFields: LogicalModelFormValues['fields'];
  logicalModelNames: string[];
  className?: string;
  onAdd: VoidFunction;
  onRemove: (index: number) => void;
}

export default function LogicalModelFieldsSection({
  form,
  fields,
  watchedFields,
  logicalModelNames,
  className,
  onAdd,
  onRemove,
}: LogicalModelFieldsSectionProps) {
  return (
    <TypedFieldsSection variant="field" className={className} onAdd={onAdd}>
      {fields.map((field, index) => (
        <LogicalModelFieldRow
          key={field.id}
          index={index}
          value={watchedFields[index]?.type ?? field.type}
          descriptionValue={watchedFields[index]?.description}
          nameError={form.formState.errors.fields?.[index]?.name?.message}
          typeError={
            form.formState.errors.fields?.[index]?.type as
              | TypeNodeError
              | undefined
          }
          logicalModelNames={logicalModelNames}
          form={form}
          onRemove={() => onRemove(index)}
        />
      ))}
    </TypedFieldsSection>
  );
}
