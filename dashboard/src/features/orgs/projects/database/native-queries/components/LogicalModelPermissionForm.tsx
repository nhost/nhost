import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { useDialog } from '@/components/common/DialogProvider';
import { PermissionSettingsSection } from '@/components/common/PermissionSettingsSection';
import { RoleActionSwitcher } from '@/components/common/RoleActionSwitcher';
import { Form } from '@/components/form/Form';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import LogicalModelFilterEditor from '@/features/orgs/projects/database/native-queries/components/LogicalModelFilterEditor';
import type { DialogFormProps } from '@/types/common';
import type {
  LogicalModelItem,
  LogicalModelSelectPermission,
  LogicalModelType,
} from '@/utils/hasura-api/generated/schemas';

const permissionSchema = z.object({
  rowCheckType: z.enum(['none', 'custom']),
  columns: z.array(z.string()).min(1, 'Select at least one field.'),
  columnsRepresentation: z.enum(['preserve', 'wildcard', 'explicit']),
  filter: z.record(z.string(), z.unknown()),
});

export type LogicalModelPermissionFormValues = z.infer<typeof permissionSchema>;

interface LogicalModelPermissionFormProps extends DialogFormProps {
  model: LogicalModelItem;
  models: LogicalModelItem[];
  role: string;
  availableRoles: string[];
  permission?: LogicalModelSelectPermission;
  isPending: boolean;
  onRoleChange: (role: string) => void;
  onSubmit: (permission: LogicalModelSelectPermission) => Promise<boolean>;
  onDelete?: () => Promise<boolean>;
  onCancel: VoidFunction;
}

function isEmptyFilter(filter?: Record<string, unknown>): boolean {
  return !filter || Object.keys(filter).length === 0;
}

function defaultValues(
  model: LogicalModelItem,
  permission?: LogicalModelSelectPermission,
): LogicalModelPermissionFormValues {
  return {
    rowCheckType: isEmptyFilter(permission?.filter) ? 'none' : 'custom',
    columns:
      permission?.columns === '*'
        ? model.fields.map(({ name }) => name)
        : (permission?.columns ?? []),
    columnsRepresentation: 'preserve',
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
  role,
  availableRoles,
  permission,
  isPending,
  onRoleChange,
  onSubmit,
  onDelete,
  onCancel,
  location,
}: LogicalModelPermissionFormProps) {
  const form = useForm<LogicalModelPermissionFormValues>({
    reValidateMode: 'onSubmit',
    resolver: zodResolver(permissionSchema),
    defaultValues: defaultValues(model, permission),
  });
  const [filterValid, setFilterValid] = useState(true);
  const { setDirtySource, openDirtyConfirmation, openAlertDialog } =
    useDialog();
  const sourceId = `logical-model-permission:${model.name}:${role}`;
  const { isDirty, isSubmitting, errors } = form.formState;
  const rowCheckType = useWatch({
    control: form.control,
    name: 'rowCheckType',
  });
  const selectedColumns = useWatch({
    control: form.control,
    name: 'columns',
  });
  const isAllFieldsSelected =
    model.fields.length > 0 &&
    model.fields.every(({ name }) => selectedColumns.includes(name));
  const fieldPaths = getFieldPaths(model, models);

  useEffect(() => {
    setDirtySource(sourceId, isDirty, location);
    return () => setDirtySource(sourceId, false, location);
  }, [isDirty, location, setDirtySource, sourceId]);

  function clearDirtySource() {
    setDirtySource(sourceId, false, location);
  }

  function handleCancel() {
    if (!isDirty) {
      onCancel();
      return;
    }
    openDirtyConfirmation({
      props: {
        onPrimaryAction: () => {
          clearDirtySource();
          onCancel();
        },
      },
    });
  }

  function handleRoleChange(nextRole: string) {
    clearDirtySource();
    onRoleChange(nextRole);
  }

  async function handleSubmit(values: LogicalModelPermissionFormValues) {
    if (!filterValid) {
      return;
    }
    const columns =
      values.columnsRepresentation === 'preserve'
        ? (permission?.columns ?? values.columns)
        : values.columnsRepresentation === 'wildcard'
          ? '*'
          : values.columns;
    const succeeded = await onSubmit({
      columns,
      filter: values.rowCheckType === 'none' ? {} : values.filter,
    });
    if (succeeded) {
      clearDirtySource();
    }
  }

  async function handleDelete() {
    if (!onDelete) {
      return;
    }
    const succeeded = await onDelete();
    if (succeeded) {
      clearDirtySource();
    }
  }

  function handleDeleteClick() {
    openAlertDialog({
      title: 'Delete permissions',
      payload: `Are you sure you want to delete the select permissions of ${role}?`,
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: handleDelete,
      },
    });
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex min-h-0 flex-auto flex-col content-between overflow-hidden border-t-1"
        sx={{ backgroundColor: 'background.default' }}
      >
        <div className="grid min-h-0 flex-auto grid-flow-row content-start gap-6 overflow-auto py-4">
          <PermissionSettingsSection
            title="Selected role & action"
            className="grid-flow-col justify-start gap-6"
          >
            <RoleActionSwitcher
              role={role}
              action="select"
              availableRoles={availableRoles}
              availableActions={['select']}
              actionLabels={{ select: 'Select' }}
              actionDisabled
              isDirty={isDirty}
              location={location}
              onRoleChange={handleRoleChange}
              onActionChange={() => {}}
            />
          </PermissionSettingsSection>

          <PermissionSettingsSection title="Row select permissions">
            <p>
              Allow role <strong>{role}</strong> to select rows:
            </p>
            <RadioGroup
              value={rowCheckType}
              className="grid grid-flow-col justify-start gap-4"
              onValueChange={(value) => {
                form.setValue(
                  'rowCheckType',
                  value as LogicalModelPermissionFormValues['rowCheckType'],
                  { shouldDirty: true },
                );
                if (value === 'none') {
                  form.setValue('filter', {}, { shouldDirty: true });
                  setFilterValid(true);
                }
              }}
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem id="logical-model-row-none" value="none" />
                <Label htmlFor="logical-model-row-none">
                  Without any checks
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem id="logical-model-row-custom" value="custom" />
                <Label htmlFor="logical-model-row-custom">
                  With custom check
                </Label>
              </div>
            </RadioGroup>
            {rowCheckType === 'custom' && (
              <Controller
                control={form.control}
                name="filter"
                render={({ field }) => (
                  <LogicalModelFilterEditor
                    value={field.value}
                    fieldPaths={fieldPaths}
                    onChange={(value) => field.onChange(value)}
                    onValidityChange={setFilterValid}
                  />
                )}
              />
            )}
          </PermissionSettingsSection>

          <PermissionSettingsSection title="Fields select permissions">
            <div className="grid grid-flow-col items-center justify-between gap-2">
              <p>Select the logical model fields this role can access.</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-primary"
                onClick={() => {
                  if (isAllFieldsSelected) {
                    form.setValue('columns', [], {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    form.setValue('columnsRepresentation', 'explicit', {
                      shouldDirty: true,
                    });
                    return;
                  }

                  form.setValue(
                    'columns',
                    model.fields.map(({ name }) => name),
                    { shouldDirty: true, shouldValidate: true },
                  );
                  form.setValue('columnsRepresentation', 'wildcard', {
                    shouldDirty: true,
                  });
                }}
              >
                {isAllFieldsSelected ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <Controller
              control={form.control}
              name="columns"
              render={({ field }) => (
                <div className="grid gap-3 sm:grid-cols-2">
                  {model.fields.map((modelField) => {
                    const checked = field.value.includes(modelField.name);
                    const id = `logical-model-field-${modelField.name}`;
                    return (
                      <div
                        key={modelField.name}
                        className="flex items-center gap-2"
                      >
                        <Checkbox
                          id={id}
                          checked={checked}
                          onCheckedChange={(next) => {
                            field.onChange(
                              next
                                ? [...field.value, modelField.name]
                                : field.value.filter(
                                    (name) => name !== modelField.name,
                                  ),
                            );
                            form.setValue('columnsRepresentation', 'explicit', {
                              shouldDirty: true,
                            });
                            void form.trigger('columns');
                          }}
                        />
                        <Label htmlFor={id}>{modelField.name}</Label>
                      </div>
                    );
                  })}
                </div>
              )}
            />
            {errors.columns?.message && (
              <p className="text-destructive text-sm">
                {errors.columns.message}
              </p>
            )}
          </PermissionSettingsSection>
        </div>

        <div className="grid flex-shrink-0 gap-2 border-t-1 p-2 sm:grid-flow-col sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>
          <div className="grid grid-flow-row gap-2 sm:grid-flow-col">
            {onDelete && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                onClick={handleDeleteClick}
                disabled={isPending}
              >
                Delete Permissions
              </Button>
            )}
            <ButtonWithLoading
              loading={isSubmitting || isPending}
              disabled={isSubmitting || isPending || !filterValid}
              size="sm"
              type="submit"
              className="justify-self-end"
            >
              Save
            </ButtonWithLoading>
          </div>
        </div>
      </Form>
    </FormProvider>
  );
}
