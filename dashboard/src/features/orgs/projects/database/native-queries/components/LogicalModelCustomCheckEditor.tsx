import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { v4 as uuidv4 } from 'uuid';
import { Textarea } from '@/components/ui/v3/textarea';
import {
  CustomCheckEditor,
  type CustomCheckEditorMode,
  CustomCheckModeProvider,
  useCustomCheckMode,
} from '@/features/orgs/projects/database/dataGrid/components/CustomCheckEditor';
import type {
  GroupNode,
  RuleNode,
} from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import logicalModelCustomCheckEditorDialect, {
  LogicalModelEditorDialectProvider,
} from '@/features/orgs/projects/database/native-queries/components/LogicalModelCustomCheckEditorDialect';
import {
  analyzeLogicalModelFilter,
  type LogicalModelFieldResolution,
  type LogicalModelFilterCompatibility,
  serializeLogicalModelFilter,
} from '@/features/orgs/projects/database/native-queries/utils/logicalModelPermissionFilter';
import { cn } from '@/lib/utils';

interface LogicalModelEditorFormValues {
  filter: GroupNode;
}

export interface LogicalModelCustomCheckEditorProps {
  value: Record<string, unknown>;
  fields: LogicalModelFieldResolution;
  compatibility?: LogicalModelFilterCompatibility;
  onChange: (value: Record<string, unknown>) => void;
  onValidityChange?: (valid: boolean) => void;
}

function cloneRaw(value: Record<string, unknown>): Record<string, unknown> {
  return structuredClone(value);
}

function areEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => areEqual(item, right[index]))
    );
  }
  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object'
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.hasOwn(rightRecord, key) &&
        areEqual(leftRecord[key], rightRecord[key]),
    )
  );
}

function emptyGroup(): GroupNode {
  return {
    type: 'group',
    id: uuidv4(),
    operator: '_implicit',
    children: [],
  };
}

interface LogicalJsonExternalReset {
  generation: number;
  value: Record<string, unknown>;
}

interface LogicalJsonEditorProps {
  initialValue: Record<string, unknown>;
  externalReset: LogicalJsonExternalReset;
  onChange: (value: Record<string, unknown>) => void;
  onValidityChange: (valid: boolean) => void;
}

function LogicalJsonEditor({
  initialValue,
  externalReset,
  onChange,
  onValidityChange,
}: LogicalJsonEditorProps) {
  const [draft, setDraft] = useState(() =>
    JSON.stringify(initialValue, null, 2),
  );
  const [error, setError] = useState<string>();

  // Controlled value echoes update initialValue, but only an explicit external
  // reset may replace an already-mounted draft or clear its validation error.
  useEffect(() => {
    setDraft(JSON.stringify(externalReset.value, null, 2));
    setError(undefined);
  }, [externalReset]);

  return (
    <div>
      <Textarea
        aria-label="Filter JSON"
        rows={10}
        spellCheck={false}
        value={draft}
        className={cn('font-mono text-xs', error && 'border-destructive')}
        onChange={(event) => {
          const nextDraft = event.target.value;
          setDraft(nextDraft);
          let parsed: unknown;
          try {
            parsed = JSON.parse(nextDraft);
          } catch {
            setError('Invalid JSON');
            onValidityChange(false);
            return;
          }
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            setError('Filter must be a JSON object');
            onValidityChange(false);
            return;
          }
          setError(undefined);
          onValidityChange(true);
          onChange(parsed as Record<string, unknown>);
        }}
      />
      {error ? <p className="mt-1 text-destructive text-sm">{error}</p> : null}
    </div>
  );
}

export function LogicalModelCustomCheckEditor({
  value,
  fields,
  compatibility: suppliedCompatibility,
  onChange,
  onValidityChange,
}: LogicalModelCustomCheckEditorProps) {
  const { mode } = useCustomCheckMode();
  const compatibility = useMemo(
    () => suppliedCompatibility ?? analyzeLogicalModelFilter(value, fields),
    [fields, suppliedCompatibility, value],
  );
  const initialNode = compatibility.compatible
    ? compatibility.node
    : emptyGroup();
  const form = useForm<LogicalModelEditorFormValues>({
    defaultValues: { filter: initialNode },
  });
  form.register('filter');
  const onChangeRef = useRef(onChange);
  const validityRef = useRef(onValidityChange);
  const fieldsRef = useRef(fields);
  const lastCommittedRaw = useRef(cloneRaw(value));
  const resetGeneration = useRef(0);
  const subscriptionGeneration = useRef(0);
  const pendingCommit = useRef<object | undefined>(undefined);
  const previousMode = useRef(mode);
  const jsonCompatibility = useRef<LogicalModelFilterCompatibility | undefined>(
    undefined,
  );
  const [jsonExternalReset, setJsonExternalReset] =
    useState<LogicalJsonExternalReset>(() => ({
      generation: 0,
      value: cloneRaw(value),
    }));

  onChangeRef.current = onChange;
  validityRef.current = onValidityChange;
  fieldsRef.current = fields;

  // The nested FormProvider owns RuleNode IDs and refs. Public callbacks only
  // receive raw metadata. Generation checks suppress reset/watch effects and
  // React Strict Mode remounts; normal visual commits update the baseline only.
  useEffect(() => {
    const lifecycle = ++subscriptionGeneration.current;
    const subscription = form.watch((_formValue, info) => {
      if (!info.name?.startsWith('filter')) {
        return;
      }
      const generation = resetGeneration.current;
      if (pendingCommit.current) {
        return;
      }
      const commit = {};
      pendingCommit.current = commit;
      queueMicrotask(() => {
        if (pendingCommit.current === commit) {
          pendingCommit.current = undefined;
        }
        if (
          lifecycle !== subscriptionGeneration.current ||
          generation !== resetGeneration.current
        ) {
          return;
        }
        const result = serializeLogicalModelFilter(
          form.getValues('filter') as RuleNode,
          fieldsRef.current,
        );
        if (
          !result.success ||
          areEqual(result.value, lastCommittedRaw.current)
        ) {
          return;
        }
        lastCommittedRaw.current = cloneRaw(result.value);
        validityRef.current?.(true);
        onChangeRef.current(result.value);
      });
    });
    return () => {
      subscription.unsubscribe();
      subscriptionGeneration.current += 1;
      pendingCommit.current = undefined;
    };
  }, [form]);

  useEffect(() => {
    if (areEqual(value, lastCommittedRaw.current)) {
      return;
    }
    resetGeneration.current += 1;
    lastCommittedRaw.current = cloneRaw(value);
    jsonCompatibility.current = undefined;
    const nextCompatibility =
      suppliedCompatibility ?? analyzeLogicalModelFilter(value, fields);
    form.reset({
      filter: nextCompatibility.compatible
        ? nextCompatibility.node
        : emptyGroup(),
    });
    setJsonExternalReset((current) => ({
      generation: current.generation + 1,
      value: cloneRaw(value),
    }));
    validityRef.current?.(true);
  }, [fields, form, suppliedCompatibility, value]);

  useEffect(() => {
    const wasJson = previousMode.current === 'json';
    previousMode.current = mode;
    if (!wasJson || mode !== 'builder') {
      return;
    }
    const nextCompatibility =
      jsonCompatibility.current ?? analyzeLogicalModelFilter(value, fields);
    jsonCompatibility.current = undefined;
    if (!nextCompatibility.compatible) {
      return;
    }
    resetGeneration.current += 1;
    form.reset({ filter: nextCompatibility.node });
    validityRef.current?.(true);
  }, [fields, form, mode, value]);

  function handleJsonChange(nextValue: Record<string, unknown>) {
    if (areEqual(nextValue, lastCommittedRaw.current)) {
      return;
    }
    // Supported JSON follows the logical codec while unsupported JSON remains
    // an exact raw pass-through value.
    jsonCompatibility.current = analyzeLogicalModelFilter(
      nextValue,
      fieldsRef.current,
    );
    lastCommittedRaw.current = cloneRaw(nextValue);
    onChangeRef.current(nextValue);
  }

  return (
    <LogicalModelEditorDialectProvider fields={fields}>
      <FormProvider {...form}>
        {mode === 'json' ? (
          <LogicalJsonEditor
            initialValue={value}
            externalReset={jsonExternalReset}
            onChange={handleJsonChange}
            onValidityChange={(valid) => validityRef.current?.(valid)}
          />
        ) : (
          <CustomCheckEditor
            schema=""
            table=""
            name="filter"
            dialect={logicalModelCustomCheckEditorDialect}
          />
        )}
      </FormProvider>
    </LogicalModelEditorDialectProvider>
  );
}

export interface LogicalModelCustomCheckEditorProviderProps {
  children: ReactNode;
  mode: CustomCheckEditorMode;
  onModeChange?: (mode: CustomCheckEditorMode) => void;
}

export function LogicalModelCustomCheckEditorProvider({
  children,
  mode,
  onModeChange,
}: LogicalModelCustomCheckEditorProviderProps) {
  return (
    <CustomCheckModeProvider mode={mode} onModeChange={onModeChange}>
      {children}
    </CustomCheckModeProvider>
  );
}
