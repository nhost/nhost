import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { Textarea } from '@/components/ui/v3/textarea';
import { cn } from '@/lib/utils';

const OPERATORS = [
  '_eq',
  '_neq',
  '_gt',
  '_gte',
  '_lt',
  '_lte',
  '_in',
  '_nin',
  '_is_null',
  '_like',
  '_ilike',
] as const;

interface VisualCondition {
  id: number;
  field: string;
  operator: string;
  value: string;
}

interface LogicalModelFilterEditorProps {
  value: Record<string, unknown>;
  fieldPaths: string[];
  onChange: (value: Record<string, unknown>) => void;
  onValidityChange: (valid: boolean) => void;
}

function parseValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function assignPath(
  target: Record<string, unknown>,
  path: string,
  operator: string,
  value: unknown,
) {
  const parts = path.split('.');
  let current = target;
  for (const part of parts.slice(0, -1)) {
    const child = current[part];
    if (!child || typeof child !== 'object' || Array.isArray(child)) {
      Object.defineProperty(current, part, {
        value: Object.create(null) as Record<string, unknown>,
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    current = current[part] as Record<string, unknown>;
  }
  Object.defineProperty(current, parts.at(-1) ?? path, {
    value: { [operator]: value },
    enumerable: true,
    configurable: true,
    writable: true,
  });
}

function extractConditions(
  filter: Record<string, unknown>,
  fieldPaths: Set<string>,
): { conditions: VisualCondition[]; hasUnsupported: boolean } {
  const conditions: VisualCondition[] = [];
  let nextId = 0;
  let hasUnsupported = false;

  function visit(value: Record<string, unknown>, prefix = '') {
    for (const [key, child] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (
        fieldPaths.has(path) &&
        child &&
        typeof child === 'object' &&
        !Array.isArray(child)
      ) {
        const operatorEntries = Object.entries(child);
        if (
          operatorEntries.length === 1 &&
          OPERATORS.includes(operatorEntries[0][0] as (typeof OPERATORS)[number])
        ) {
          conditions.push({
            id: nextId++,
            field: path,
            operator: operatorEntries[0][0],
            value: JSON.stringify(operatorEntries[0][1]),
          });
          continue;
        }
      }

      const isNestedField = [...fieldPaths].some((field) =>
        field.startsWith(`${path}.`),
      );
      if (
        isNestedField &&
        child &&
        typeof child === 'object' &&
        !Array.isArray(child)
      ) {
        visit(child as Record<string, unknown>, path);
      } else {
        hasUnsupported = true;
      }
    }
  }

  visit(filter);
  return { conditions, hasUnsupported };
}

export default function LogicalModelFilterEditor({
  value,
  fieldPaths,
  onChange,
  onValidityChange,
}: LogicalModelFilterEditorProps) {
  const [mode, setMode] = useState<'visual' | 'json'>('visual');
  const [jsonDraft, setJsonDraft] = useState<string | null>(null);
  const [jsonError, setJsonError] = useState<string>();
  const extracted = useMemo(
    () => extractConditions(value, new Set(fieldPaths)),
    [fieldPaths, value],
  );
  const [conditions, setConditions] = useState<VisualCondition[]>(
    extracted.conditions,
  );
  const [nextId, setNextId] = useState(extracted.conditions.length);

  function updateConditions(next: VisualCondition[]) {
    setConditions(next);
    const filter = Object.create(null) as Record<string, unknown>;
    for (const condition of next) {
      if (condition.field && condition.operator) {
        assignPath(
          filter,
          condition.field,
          condition.operator,
          parseValue(condition.value),
        );
      }
    }
    onChange(filter);
    onValidityChange(true);
    setJsonDraft(null);
  }

  function switchMode(nextMode: 'visual' | 'json') {
    setMode(nextMode);
    if (nextMode === 'visual') {
      setConditions(extracted.conditions);
      setNextId(extracted.conditions.length);
      return;
    }

    setJsonDraft(JSON.stringify(value, null, 2));
    setJsonError(undefined);
    onValidityChange(true);
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-md border p-1" aria-label="Filter editor mode">
        {(['visual', 'json'] as const).map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={mode === item ? 'secondary' : 'ghost'}
            aria-pressed={mode === item}
            onClick={() => switchMode(item)}
          >
            {item === 'visual' ? 'Visual' : 'JSON'}
          </Button>
        ))}
      </div>

      {mode === 'visual' ? (
        <div className="space-y-3">
          {extracted.hasUnsupported && (
            <p className="rounded-md bg-muted p-3 text-muted-foreground text-sm">
              This filter contains conditions that can only be edited in JSON mode.
              Switching modes does not change them.
            </p>
          )}
          {conditions.map((condition) => (
            <div key={condition.id} className="grid grid-cols-[1fr_9rem_1fr_auto] gap-2">
              <select
                aria-label={`Filter field ${condition.id + 1}`}
                value={condition.field}
                disabled={extracted.hasUnsupported}
                onChange={(event) =>
                  updateConditions(
                    conditions.map((item) =>
                      item.id === condition.id
                        ? { ...item, field: event.target.value }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                {fieldPaths.map((field) => (
                  <option key={field} value={field}>
                    {field}
                  </option>
                ))}
              </select>
              <select
                aria-label={`Filter operator ${condition.id + 1}`}
                value={condition.operator}
                disabled={extracted.hasUnsupported}
                onChange={(event) =>
                  updateConditions(
                    conditions.map((item) =>
                      item.id === condition.id
                        ? { ...item, operator: event.target.value }
                        : item,
                    ),
                  )
                }
                className="h-10 rounded-md border bg-background px-3 text-sm"
              >
                {OPERATORS.map((operator) => (
                  <option key={operator} value={operator}>
                    {operator}
                  </option>
                ))}
              </select>
              <Input
                aria-label={`Filter value ${condition.id + 1}`}
                value={condition.value}
                disabled={extracted.hasUnsupported}
                onChange={(event) =>
                  updateConditions(
                    conditions.map((item) =>
                      item.id === condition.id
                        ? { ...item, value: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove filter condition ${condition.id + 1}`}
                disabled={extracted.hasUnsupported}
                onClick={() =>
                  updateConditions(
                    conditions.filter((item) => item.id !== condition.id),
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={fieldPaths.length === 0 || extracted.hasUnsupported}
            onClick={() => {
              const condition = {
                id: nextId,
                field: fieldPaths[0] ?? '',
                operator: '_eq',
                value: 'null',
              };
              setNextId(nextId + 1);
              updateConditions([...conditions, condition]);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add condition
          </Button>
        </div>
      ) : (
        <div>
          <Textarea
            aria-label="Filter JSON"
            rows={10}
            spellCheck={false}
            value={jsonDraft ?? JSON.stringify(value, null, 2)}
            className={cn('font-mono text-xs', jsonError && 'border-destructive')}
            onChange={(event) => {
              const next = event.target.value;
              setJsonDraft(next);
              try {
                const parsed: unknown = JSON.parse(next);
                if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
                  throw new Error('Filter must be a JSON object');
                }
                setJsonError(undefined);
                onValidityChange(true);
                onChange(parsed as Record<string, unknown>);
              } catch (error) {
                const message =
                  error instanceof Error && error.message === 'Filter must be a JSON object'
                    ? error.message
                    : 'Invalid JSON';
                setJsonError(message);
                onValidityChange(false);
              }
            }}
          />
          {jsonError && <p className="mt-1 text-destructive text-sm">{jsonError}</p>}
        </div>
      )}
    </div>
  );
}
