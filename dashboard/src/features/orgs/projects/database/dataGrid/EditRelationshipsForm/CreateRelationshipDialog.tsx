import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowRight, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/v3/form';
import { SelectItem, SelectSeparator } from '@/components/ui/v3/select';
import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useCreateArrayRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateArrayRelationshipMutation';
import { useCreateObjectRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateObjectRelationshipMutation';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  CreateArrayRelationshipArgs,
  CreateObjectRelationshipArgs,
} from '@/utils/hasura-api/generated/schemas';

interface CreateRelationshipDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  source: string;
  /**
   * Schema where the relationship is located.
   */
  schema: string;
  /**
   * Table to delete the relationship from.
   */
  tableName: string;
  onSuccess?: () => Promise<void> | void;
}

const createRelationshipFormSchema = z
  .object({
    name: z.string().min(1, { message: 'Name is required' }),
    fromSource: z.object(
      {
        schema: z.string().min(1),
        table: z.string().min(1),
        source: z.string().min(1),
      },
      { required_error: 'From source is required' },
    ),
    toReference: z.object(
      {
        schema: z.string().min(1),
        table: z.string().min(1),
        source: z.string().min(1),
      },
      { required_error: 'To reference is required' },
    ),
    relationshipType: z.enum(['array', 'object'], {
      required_error: 'Relationship type is required',
    }),
    fieldMapping: z.array(
      z.object({
        sourceColumn: z
          .string()
          .min(1, { message: 'Source column is required' }),
        referenceColumn: z
          .string()
          .min(1, { message: 'Reference column is required' }),
      }),
    ),
  })
  .superRefine((data, ctx) => {
    if (data.relationshipType === 'array' && data.fieldMapping.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'At least one column mapping is required for array relationships.',
        path: ['fieldMapping'],
      });
    }
  });

export type CreateRelationshipFormValues = z.infer<
  typeof createRelationshipFormSchema
>;

function transformTableSelectValue<
  T extends { source: string; schema: string; table: string },
>(value: unknown): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T;
  }

  return JSON.stringify(value) as unknown as T;
}

export default function CreateRelationshipDialog({
  open,
  setOpen,
  source,
  schema,
  tableName,
  onSuccess,
}: CreateRelationshipDialogProps) {
  const queryClient = useQueryClient();
  const { data: resourceVersion } = useGetMetadataResourceVersion();
  const {
    mutateAsync: createArrayRelationship,
    isLoading: isCreatingArrayRelationship,
  } = useCreateArrayRelationshipMutation();
  const {
    mutateAsync: createObjectRelationship,
    isLoading: isCreatingObjectRelationship,
  } = useCreateObjectRelationshipMutation();

  const isCreatingRelationship =
    isCreatingArrayRelationship || isCreatingObjectRelationship;

  const { data: metadata } = useGetMetadata();

  const allTables = useMemo(
    () =>
      metadata?.sources?.flatMap((metadataSource) =>
        (metadataSource.tables ?? []).map((table) => ({
          source: metadataSource.name!,
          schema: table.table.schema!,
          table: table.table.name!,
        })),
      ) ?? [],
    [metadata],
  );

  const tableOptions = useMemo(
    () =>
      allTables.map((table) => ({
        label: `${table.source}/${table.schema}/${table.table}`,
        value: JSON.stringify(table),
      })),
    [allTables],
  );

  const form = useForm<CreateRelationshipFormValues>({
    resolver: zodResolver(createRelationshipFormSchema),
    defaultValues: {
      name: '',
      fromSource: {
        schema,
        table: tableName,
        source,
      },
      toReference: {
        schema,
        table: tableName,
        source,
      },
      relationshipType: 'object',
      fieldMapping: [],
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    const defaultTable = allTables.find(
      (table) =>
        table.source === source &&
        table.schema === schema &&
        table.table === tableName,
    ) ??
      allTables[0] ?? {
        source,
        schema,
        table: tableName,
      };

    form.reset({
      name: '',
      fromSource: defaultTable,
      toReference: defaultTable,
      relationshipType: 'object',
      fieldMapping: [],
    });
  }, [open, allTables, form, schema, source, tableName]);

  const selectedFromSource = useWatch({
    control: form.control,
    name: 'fromSource',
  });

  const selectedToReference = useWatch({
    control: form.control,
    name: 'toReference',
  });

  const { data: fromTableData } = useTableQuery(
    [
      `create-relationship.${selectedFromSource?.source}.${selectedFromSource?.schema}.${selectedFromSource?.table}`,
    ],
    {
      dataSource: selectedFromSource?.source,
      schema: selectedFromSource?.schema,
      table: selectedFromSource?.table,
      queryOptions: {
        enabled:
          open &&
          Boolean(
            selectedFromSource?.source &&
              selectedFromSource?.schema &&
              selectedFromSource?.table,
          ),
      },
    },
  );

  const { data: toTableData } = useTableQuery(
    [
      `create-relationship.${selectedToReference?.source}.${selectedToReference?.schema}.${selectedToReference?.table}`,
    ],
    {
      dataSource: selectedToReference?.source,
      schema: selectedToReference?.schema,
      table: selectedToReference?.table,
      queryOptions: {
        enabled:
          open &&
          Boolean(
            selectedToReference?.source &&
              selectedToReference?.schema &&
              selectedToReference?.table,
          ),
      },
    },
  );

  const fromColumns = useMemo(
    () =>
      fromTableData?.columns
        ?.map((column: { column_name?: string }) => column.column_name ?? '')
        ?.filter(Boolean) ?? [],
    [fromTableData],
  );

  const toColumns = useMemo(
    () =>
      toTableData?.columns
        ?.map((column: { column_name?: string }) => column.column_name ?? '')
        ?.filter(Boolean) ?? [],
    [toTableData],
  );

  const {
    fields: fieldMappingFields,
    append: appendFieldMapping,
    remove: removeFieldMapping,
  } = useFieldArray({
    control: form.control,
    name: 'fieldMapping',
  });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      form.reset();
    }
    setOpen(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[720px]"
        hideCloseButton
        disableOutsideClick={isCreatingRelationship}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
            Create Relationship
          </DialogTitle>
          <DialogDescription>
            Create and track a new relationship in your GraphQL schema.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              if (!resourceVersion) {
                return;
              }

              const baseTable = {
                schema: values.fromSource.schema,
                name: values.fromSource.table,
              };

              const relationshipSource = values.fromSource.source;

              const remoteTable = {
                schema: values.toReference.schema,
                name: values.toReference.table,
              };

              const columnMappingEntries = values.fieldMapping
                .filter(
                  (mapping) => mapping.sourceColumn && mapping.referenceColumn,
                )
                .map((mapping) => [
                  mapping.sourceColumn,
                  mapping.referenceColumn,
                ]);

              const columnMapping = Object.fromEntries(columnMappingEntries);

              let promise: Promise<unknown> | undefined;

              if (values.relationshipType === 'array') {
                const remoteColumns = values.fieldMapping
                  .map((mapping) => mapping.referenceColumn)
                  .filter(Boolean);

                const foreignKeyColumn = remoteColumns[0];

                if (!foreignKeyColumn) {
                  return;
                }

                const args: CreateArrayRelationshipArgs = {
                  table: baseTable,
                  name: values.name,
                  source: values.fromSource.source,
                  using: {
                    foreign_key_constraint_on: {
                      table: remoteTable,
                      columns: foreignKeyColumn,
                    },
                  },
                };

                promise = createArrayRelationship({
                  resourceVersion,
                  args,
                });
              } else {
                const args: CreateObjectRelationshipArgs = {
                  table: baseTable,
                  name: values.name,
                  source: values.fromSource.source,
                  using: {
                    manual_configuration: {
                      remote_table: remoteTable,
                      column_mapping: columnMapping,
                    },
                  },
                };

                promise = createObjectRelationship({
                  resourceVersion,
                  args,
                });
              }

              if (!promise) {
                return;
              }

              await execPromiseWithErrorToast(
                async () => {
                  await promise;
                },
                {
                  loadingMessage: 'Creating relationship...',
                  successMessage: 'Relationship created successfully.',
                  errorMessage:
                    'An error occurred while creating the relationship.',
                },
              );

              await Promise.all([
                queryClient.invalidateQueries({
                  queryKey: ['export-metadata'],
                  exact: false,
                }),
                queryClient.invalidateQueries({
                  queryKey: ['suggest-relationships', relationshipSource],
                }),
              ]);

              setOpen(false);
              await onSuccess?.();
            })}
            className="flex flex-col gap-6 text-foreground"
          >
            <FormInput
              control={form.control}
              name="name"
              label="Relationship Name"
              placeholder="Name..."
              autoComplete="off"
            />

            <div className="flex flex-row gap-4">
              <div className="flex flex-1 flex-col gap-2 rounded-md border p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  From Source
                </h3>

                <FormSelect
                  control={form.control}
                  name="fromSource"
                  label="Table"
                  placeholder="Select source table"
                  transformValue={(value) =>
                    transformTableSelectValue<
                      CreateRelationshipFormValues['fromSource']
                    >(value)
                  }
                  disabled
                >
                  {tableOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </FormSelect>
              </div>

              <div className="flex flex-1 flex-col gap-2 rounded-md border p-4">
                <h3 className="text-sm font-semibold text-foreground">
                  To Reference
                </h3>

                <FormSelect
                  control={form.control}
                  name="toReference"
                  label="Table"
                  placeholder="Select reference table"
                  transformValue={(value) =>
                    transformTableSelectValue<
                      CreateRelationshipFormValues['toReference']
                    >(value)
                  }
                >
                  {tableOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </FormSelect>
              </div>
            </div>

            <div className="flex flex-col gap-4 rounded-md border p-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Relationship Details
                </h3>
                <FormDescription>
                  Select the relationship type and map the columns between the
                  tables.
                </FormDescription>
              </div>

              <FormSelect
                control={form.control}
                name="relationshipType"
                label="Relationship Type"
                placeholder="Select relationship type"
              >
                <SelectItem value="object">Object Relationship</SelectItem>
                <SelectItem value="array">Array Relationship</SelectItem>
              </FormSelect>

              <div className="space-y-2 rounded-md border p-4">
                <div className="grid grid-cols-12 items-center gap-2 text-sm font-semibold text-muted-foreground">
                  <span className="col-span-5">Source Column</span>
                  <div className="col-span-2 flex justify-center">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                  <span className="col-span-5 text-right">
                    Reference Column
                  </span>
                </div>
                <SelectSeparator />
                <div className="space-y-3">
                  {fieldMappingFields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-12 items-center gap-2"
                    >
                      <FormSelect
                        control={form.control}
                        name={`fieldMapping.${index}.sourceColumn`}
                        label=""
                        placeholder="Select source column"
                        containerClassName="col-span-5"
                      >
                        {fromColumns.map((column) => (
                          <SelectItem key={column} value={column}>
                            {column}
                          </SelectItem>
                        ))}
                        {fromColumns.length === 0 && (
                          <SelectItem disabled value="__no-source-columns">
                            No columns available
                          </SelectItem>
                        )}
                      </FormSelect>

                      <div className="col-span-2 flex justify-center">
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <FormSelect
                        control={form.control}
                        name={`fieldMapping.${index}.referenceColumn`}
                        label=""
                        placeholder="Select reference column"
                        containerClassName="col-span-4 col-start-8"
                      >
                        {toColumns.map((column) => (
                          <SelectItem key={column} value={column}>
                            {column}
                          </SelectItem>
                        ))}
                        {toColumns.length === 0 && (
                          <SelectItem disabled value="__no-reference-columns">
                            No columns available
                          </SelectItem>
                        )}
                      </FormSelect>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="col-span-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => removeFieldMapping(index)}
                        disabled={fieldMappingFields.length === 0}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="flex justify-start">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() =>
                        appendFieldMapping({
                          sourceColumn: fromColumns[0] ?? '',
                          referenceColumn: toColumns[0] ?? '',
                        })
                      }
                      disabled={
                        fromColumns.length === 0 || toColumns.length === 0
                      }
                    >
                      <PlusIcon className="h-4 w-4" /> Add New Mapping
                    </Button>
                  </div>

                  <FormField
                    control={form.control}
                    name="fieldMapping"
                    render={() => (
                      <FormItem>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
              <ButtonWithLoading
                type="submit"
                loading={isCreatingRelationship}
                disabled={isCreatingRelationship}
                className="!text-sm+"
              >
                Create Relationship
              </ButtonWithLoading>
              <DialogClose asChild>
                <Button variant="outline" className="!text-sm+ text-foreground">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
