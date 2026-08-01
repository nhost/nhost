import { Columns, Group, Plus } from 'lucide-react';
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import { Input } from '@/components/ui/v3/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
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
import { cn } from '@/lib/utils';

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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={selectableFields.length === 0}
          className={cn(
            'justify-start text-muted-foreground',
            fullWidth && 'w-full',
          )}
        >
          <Plus className="mr-2 h-4 w-4" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
      >
        <Command>
          <CommandInput autoFocus placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No options found.</CommandEmpty>
            <CommandGroup heading="Boolean operators">
              <CommandItem value="_and" onSelect={() => addGroup('_and')}>
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                and
              </CommandItem>
              <CommandItem value="_or" onSelect={() => addGroup('_or')}>
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                or
              </CommandItem>
              <CommandItem value="_not" onSelect={() => addGroup('_not')}>
                <Group className="mr-2 h-4 w-4 text-muted-foreground" />
                not
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Columns">
              {selectableFields.map((field) => (
                <CommandItem
                  key={field.path}
                  value={field.path}
                  onSelect={addCondition}
                >
                  <Columns className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{field.path}</span>
                  {field.scalar && (
                    <code className="ml-auto rounded bg-primary px-1 font-mono text-white text-xs">
                      {field.scalar}
                    </code>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function LogicalConditionField({
  name,
  onFieldSelectionChange,
}: ConditionFieldRendererProps) {
  const fields = useLogicalFields();
  const { control, setValue, clearErrors } = useFormContext();
  const { field } = useController({ name: `${name}.column`, control });
  const onFieldSelectionChangeRef = useRef(onFieldSelectionChange);
  onFieldSelectionChangeRef.current = onFieldSelectionChange;
  const selected = fields.descriptors.find(
    (descriptor) => descriptor.selectable && descriptor.path === field.value,
  );
  const selectedFieldPath = selected?.path;
  const selectedFieldType = selected?.scalar ?? '';

  useEffect(() => {
    if (selectedFieldPath !== undefined) {
      onFieldSelectionChangeRef.current({
        fieldPath: selectedFieldPath,
        fieldType: selectedFieldType,
      });
    }
  }, [selectedFieldPath, selectedFieldType]);

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
