import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import LogicalModelFilterEditor from '@/features/orgs/projects/database/native-queries/components/LogicalModelFilterEditor';
import type {
  LogicalModelItem,
  LogicalModelSelectPermission,
  LogicalModelType,
} from '@/utils/hasura-api/generated/schemas';

const permissionSchema = z
  .object({
    columnsMode: z.enum(['all', 'subset']),
    columns: z.array(z.string()),
    filter: z.record(z.string(), z.unknown()),
  })
  .superRefine((value, context) => {
    if (value.columnsMode === 'subset' && value.columns.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['columns'],
        message: 'Select at least one field.',
      });
    }
  });

export type LogicalModelPermissionFormValues = z.infer<typeof permissionSchema>;

interface LogicalModelPermissionFormProps {
  model: LogicalModelItem;
  models: LogicalModelItem[];
  permission?: LogicalModelSelectPermission;
  resetToken: string;
  isPending: boolean;
  onSubmit: (permission: LogicalModelSelectPermission) => Promise<void>;
  onDelete?: VoidFunction;
  onCancel: VoidFunction;
  cancelLabel?: string;
}

function defaultValues(
  permission?: LogicalModelSelectPermission,
): LogicalModelPermissionFormValues {
  return {
    columnsMode: permission?.columns === '*' ? 'all' : 'subset',
    columns: permission?.columns === '*' ? [] : (permission?.columns ?? []),
    filter: permission?.filter ?? {},
  };
}

function getReferencedModel(type: LogicalModelType): string | undefined {
  if ('logical_model' in type) {
    return type.logical_model;
  }
  if ('array' in type) {
    return getReferencedModel(type.array);
  }
  return undefined;
}

function getFieldPaths(model: LogicalModelItem, models: LogicalModelItem[]) {
  const paths: string[] = [];

  function visit(
    current: LogicalModelItem,
    prefix: string,
    visited: Set<string>,
  ) {
    for (const field of current.fields) {
      const path = prefix ? `${prefix}.${field.name}` : field.name;
      paths.push(path);
      const reference = getReferencedModel(field.type);
      const referenced = models.find((item) => item.name === reference);
      if (referenced && !visited.has(referenced.name)) {
        visit(referenced, path, new Set([...visited, referenced.name]));
      }
    }
  }

  visit(model, '', new Set([model.name]));
  return paths;
}

export default function LogicalModelPermissionForm({
  model,
  models,
  permission,
  resetToken,
  isPending,
  onSubmit,
  onDelete,
  onCancel,
  cancelLabel = 'Cancel',
}: LogicalModelPermissionFormProps) {
  const form = useForm<LogicalModelPermissionFormValues>({
    resolver: zodResolver(permissionSchema),
    defaultValues: defaultValues(permission),
  });
  const [filterValid, setFilterValid] = useState(true);
  const reset = form.reset;

  // biome-ignore lint/correctness/useExhaustiveDependencies: resetToken intentionally forces a reset when a mutation completes.
  useEffect(() => {
    reset(defaultValues(permission));
    setFilterValid(true);
  }, [permission, reset, resetToken]);

  const columnsMode = form.watch('columnsMode');
  const fieldPaths = getFieldPaths(model, models);

  return (
    <form
      className="space-y-6"
      onSubmit={form.handleSubmit(async (values) => {
        if (!filterValid) {
          return;
        }
        await onSubmit({
          columns: values.columnsMode === 'all' ? '*' : values.columns,
          filter: values.filter,
        });
      })}
    >
      <section className="space-y-3">
        <div>
          <h3 className="font-medium text-foreground">Fields</h3>
          <p className="text-muted-foreground text-sm">
            Choose every field or an explicit subset for this role.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" value="all" {...form.register('columnsMode')} />
          All fields
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            value="subset"
            {...form.register('columnsMode')}
          />
          Selected fields
        </label>
        {columnsMode === 'subset' && (
          <Controller
            control={form.control}
            name="columns"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {model.fields.map((modelField) => {
                  const checked = field.value.includes(modelField.name);
                  return (
                    <label
                      key={modelField.name}
                      htmlFor={`logical-model-field-${modelField.name}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <Checkbox
                        id={`logical-model-field-${modelField.name}`}
                        checked={checked}
                        onCheckedChange={(next) =>
                          field.onChange(
                            next
                              ? [...field.value, modelField.name]
                              : field.value.filter(
                                  (name) => name !== modelField.name,
                                ),
                          )
                        }
                      />
                      {modelField.name}
                    </label>
                  );
                })}
              </div>
            )}
          />
        )}
        {form.formState.errors.columns?.message && (
          <p className="text-destructive text-sm">
            {form.formState.errors.columns.message}
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-medium text-foreground">Row filter</h3>
          <p className="text-muted-foreground text-sm">
            Build field conditions visually or author the complete expression as
            JSON.
          </p>
        </div>
        <Controller
          control={form.control}
          name="filter"
          render={({ field }) => (
            <LogicalModelFilterEditor
              key={resetToken}
              value={field.value}
              fieldPaths={fieldPaths}
              onChange={field.onChange}
              onValidityChange={setFilterValid}
            />
          )}
        />
      </section>

      <div className="flex items-center justify-between gap-3">
        <div>
          {onDelete && (
            <Button
              type="button"
              variant="destructive"
              disabled={isPending}
              onClick={onDelete}
            >
              Delete permission
            </Button>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button type="submit" disabled={isPending || !filterValid}>
            Save permission
          </Button>
        </div>
      </div>
    </form>
  );
}
