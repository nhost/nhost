import { createContext, type ReactNode, useContext, useState } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import AddNodeMenu from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/AddNodeMenu';
import ConditionValue from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/ConditionValue';
import type {
  AddNodeRendererProps,
  ConditionFieldRendererProps,
  ConditionOperatorRendererProps,
  ConditionValueRendererProps,
  CustomCheckEditorDialect,
  GroupOperatorRendererProps,
  NodeRendererProps,
} from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/useCustomCheckEditor';
import type { LogicalOperator } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import {
  LOGICAL_MODEL_COMPARISON_OPERATORS,
  type LogicalModelFieldResolution,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';

const LogicalFieldsContext = createContext<LogicalModelFieldResolution | null>(
  null,
);

export interface LogicalModelEditorDialectProviderProps {
  children: ReactNode;
  fields: LogicalModelFieldResolution;
}

export function LogicalModelEditorDialectProvider({
  children,
  fields,
}: LogicalModelEditorDialectProviderProps) {
  return (
    <LogicalFieldsContext.Provider value={fields}>
      {children}
    </LogicalFieldsContext.Provider>
  );
}

function useLogicalFields(): LogicalModelFieldResolution {
  const fields = useContext(LogicalFieldsContext);
  if (!fields) {
    throw new Error('Logical editor fields are unavailable.');
  }
  return fields;
}

function parseInputValue(value: string): unknown {
  if (value === '') {
    return '';
  }
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function displayInputValue(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value === undefined) {
    return '';
  }
  return JSON.stringify(value);
}

function LogicalAddNode({
  onSelect,
  fullWidth,
  label = 'Add check',
}: AddNodeRendererProps) {
  const [open, setOpen] = useState(false);
  const fields = useLogicalFields();
  const selectableFields = fields.descriptors.filter(
    (descriptor) => descriptor.selectable,
  );

  function addCondition(fieldPath: string) {
    onSelect({
      type: 'condition',
      id: uuidv4(),
      column: fieldPath,
      operator: '_eq',
      value: null,
    });
    setOpen(false);
  }

  function addGroup(operator: '_and' | '_or' | '_not') {
    onSelect({
      type: 'group',
      id: uuidv4(),
      operator,
      children: [],
    });
    setOpen(false);
  }

  return (
    <AddNodeMenu
      open={open}
      onOpenChange={setOpen}
      disabled={selectableFields.length === 0}
      fullWidth={fullWidth}
      label={label}
      columns={selectableFields.map((field) => ({
        value: field.path,
        label: field.path,
        badge: field.scalar,
      }))}
      onSelectColumn={addCondition}
      onSelectGroup={addGroup}
    />
  );
}

function LogicalConditionField({
  name,
  onFieldSelectionChange,
}: ConditionFieldRendererProps) {
  const fields = useLogicalFields();
  const { control, setValue, clearErrors } = useFormContext();
  const { field } = useController({ name: `${name}.column`, control });

  return (
    <Select
      value={field.value ?? ''}
      onValueChange={(fieldPath) => {
        const descriptor = fields.descriptors.find(
          (item) => item.selectable && item.path === fieldPath,
        );
        setValue(`${name}.column`, fieldPath, { shouldDirty: true });
        setValue(`${name}.operator`, '_eq', { shouldDirty: true });
        setValue(`${name}.value`, null, { shouldDirty: true });
        clearErrors();
        onFieldSelectionChange({
          fieldPath,
          fieldType: descriptor?.scalar ?? '',
        });
      }}
    >
      <SelectTrigger aria-label="Logical model field">
        <SelectValue placeholder="Select field..." />
      </SelectTrigger>
      <SelectContent>
        {fields.selectablePaths.map((fieldPath) => (
          <SelectItem key={fieldPath} value={fieldPath}>
            {fieldPath}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LogicalConditionOperator({ name }: ConditionOperatorRendererProps) {
  const { setValue } = useFormContext();
  const operator = useWatch({ name: `${name}.operator` });

  return (
    <Select
      value={operator ?? ''}
      onValueChange={(nextOperator) => {
        const nextValue =
          nextOperator === '_is_null'
            ? true
            : nextOperator === '_in' || nextOperator === '_nin'
              ? []
              : null;
        setValue(`${name}.operator`, nextOperator, { shouldDirty: true });
        setValue(`${name}.value`, nextValue, { shouldDirty: true });
      }}
    >
      <SelectTrigger aria-label="Logical model operator">
        <SelectValue placeholder="Select operator..." />
      </SelectTrigger>
      <SelectContent>
        {LOGICAL_MODEL_COMPARISON_OPERATORS.map((item) => (
          <SelectItem key={item} value={item}>
            {item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LogicalConditionValue({
  name,
  className,
}: ConditionValueRendererProps) {
  const { control, setValue } = useFormContext();
  const { field } = useController({ name: `${name}.value`, control });
  const operator = useWatch({ name: `${name}.operator` });

  if (operator === '_is_null') {
    return (
      <Select
        value={String(field.value)}
        onValueChange={(value) =>
          setValue(`${name}.value`, value === 'true', { shouldDirty: true })
        }
      >
        <SelectTrigger aria-label="Logical model value" className={className}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">true</SelectItem>
          <SelectItem value="false">false</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  if (operator === '_in' || operator === '_nin') {
    return (
      <Input
        aria-label="Logical model value"
        className={className}
        value={displayInputValue(field.value)}
        placeholder="Value or X-Hasura-* variable"
        onChange={(event) =>
          setValue(`${name}.value`, parseInputValue(event.target.value), {
            shouldDirty: true,
          })
        }
      />
    );
  }

  return (
    <ConditionValue
      name={name}
      selectedTablePath=""
      className={className}
      ariaLabel="Logical model value"
      parseCreatedValue={parseInputValue}
    />
  );
}

function LogicalGroupOperator({ name }: GroupOperatorRendererProps) {
  const { setValue } = useFormContext();
  const operator: LogicalOperator = useWatch({ name: `${name}.operator` });

  return (
    <Select
      value={operator}
      onValueChange={(value) =>
        setValue(`${name}.operator`, value, { shouldDirty: true })
      }
    >
      <SelectTrigger
        aria-label="Logical group operator"
        className="h-7 w-28 bg-background"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_implicit">Implicit</SelectItem>
        <SelectItem value="_and">AND</SelectItem>
        <SelectItem value="_or">OR</SelectItem>
        <SelectItem value="_not">NOT</SelectItem>
      </SelectContent>
    </Select>
  );
}

function UnsupportedLogicalNode({ onRemove }: NodeRendererProps) {
  return (
    <div className="flex items-center justify-between rounded-md border border-destructive p-2 text-destructive text-sm">
      Unsupported logical-model node
      {onRemove ? (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      ) : null}
    </div>
  );
}

const logicalModelCustomCheckEditorDialect: CustomCheckEditorDialect = {
  AddNode: LogicalAddNode,
  ConditionField: LogicalConditionField,
  ConditionOperator: LogicalConditionOperator,
  ConditionValue: LogicalConditionValue,
  GroupOperator: LogicalGroupOperator,
  ExistsNode: UnsupportedLogicalNode,
  RelationshipNode: UnsupportedLogicalNode,
  UnsupportedNode: UnsupportedLogicalNode,
};

export default logicalModelCustomCheckEditorDialect;
