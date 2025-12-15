import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';

import { FormCombobox } from '@/components/form/FormCombobox';
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
import { EditRemoteSchemaRelationshipDialogControlled } from '@/features/orgs/projects/database/dataGrid/EditRelationshipsForm/dialogs/EditRemoteSchemaRelationshipDialog';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useGetRemoteSchemas } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas';

export interface BaseRelationshipDialogProps {
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
  dialogTitle?: string;
  dialogDescription?: string;
  submitButtonText?: string;
  initialValues?: RelationshipFormValues;
  onSubmitRelationship: (values: RelationshipFormValues) => Promise<void>;
  /**
   * External loading state for submit (e.g. mutation loading).
   * Base dialog will also consider the form's submitting state.
   */
  isSubmitting?: boolean;
}

const relationshipFormSchema = z
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

export type RelationshipFormValues = z.infer<typeof relationshipFormSchema>;

export function BaseRelationshipDialog({
  open,
  setOpen,
  source,
  schema,
  tableName,
  onSuccess,
  dialogTitle = 'Create Relationship',
  dialogDescription = 'Create and track a new relationship in your GraphQL schema.',
  submitButtonText = 'Create Relationship',
  initialValues,
  onSubmitRelationship,
  isSubmitting,
}: BaseRelationshipDialogProps) {
  const { data: remoteSchemas, status: remoteSchemasStatus } =
    useGetRemoteSchemas();

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

  const sourceOptions = useMemo(
    () =>
      Array.from(new Set(allTables.map((table) => table.source)))
        .sort((a, b) => a.localeCompare(b))
        .filter(Boolean),
    [allTables],
  );

  const schemaOptionsBySource = useMemo(() => {
    const map: Record<string, string[]> = {};

    allTables.forEach((table) => {
      if (!map[table.source]) {
        map[table.source] = [];
      }

      if (!map[table.source].includes(table.schema)) {
        map[table.source].push(table.schema);
        map[table.source].sort((a, b) => a.localeCompare(b));
      }
    });

    return map;
  }, [allTables]);

  const tablesBySourceSchema = useMemo(() => {
    const map: Record<string, string[]> = {};

    allTables.forEach((table) => {
      const key = `${table.source}.${table.schema}`;

      if (!map[key]) {
        map[key] = [];
      }

      if (!map[key].includes(table.table)) {
        map[key].push(table.table);
        map[key].sort((a, b) => a.localeCompare(b));
      }
    });

    return map;
  }, [allTables]);

  const getTableKey = (tableSource?: string, tableSchema?: string) =>
    tableSource && tableSchema ? `${tableSource}.${tableSchema}` : null;

  const form = useForm<RelationshipFormValues>({
    resolver: zodResolver(relationshipFormSchema),
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

  const { formState } = form;
  const isFormSubmitting = formState.isSubmitting;
  const shouldSkipAutoSelection = Boolean(initialValues) && !formState.isDirty;

  const isSubmittingRelationship = Boolean(isSubmitting) || isFormSubmitting;

  const {
    fields: fieldMappingFields,
    append: appendFieldMapping,
    remove: removeFieldMapping,
    replace: replaceFieldMapping,
  } = useFieldArray({
    control: form.control,
    name: 'fieldMapping',
  });

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialValues) {
      form.reset(initialValues);
      replaceFieldMapping(initialValues.fieldMapping ?? []);
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

    const defaultValues: RelationshipFormValues = {
      name: '',
      fromSource: defaultTable,
      toReference: defaultTable,
      relationshipType: 'object',
      fieldMapping: [],
    };

    form.reset(defaultValues);
    replaceFieldMapping(defaultValues.fieldMapping);
  }, [
    open,
    allTables,
    form,
    schema,
    source,
    tableName,
    initialValues,
    replaceFieldMapping,
  ]);

  const selectedFromSource = useWatch({
    control: form.control,
    name: 'fromSource',
  });

  const selectedToReference = useWatch({
    control: form.control,
    name: 'toReference',
  });

  const [
    showCreateRemoteSchemaRelationshipDialog,
    setShowCreateRemoteSchemaRelationshipDialog,
  ] = useState(false);
  const [defaultRemoteSchema, setDefaultRemoteSchema] = useState('');

  const REMOTE_SCHEMA_PREFIX = 'remote_schema:';
  const selectedRemoteSchemaFromToSource =
    selectedToReference?.source?.startsWith(REMOTE_SCHEMA_PREFIX)
      ? selectedToReference.source.slice(REMOTE_SCHEMA_PREFIX.length)
      : null;

  const fromSchemaOptions = useMemo(
    () =>
      selectedFromSource?.source
        ? (schemaOptionsBySource[selectedFromSource.source] ?? [])
        : [],
    [schemaOptionsBySource, selectedFromSource?.source],
  );

  const toSchemaOptions = useMemo(
    () =>
      selectedToReference?.source
        ? (schemaOptionsBySource[selectedToReference.source] ?? [])
        : [],
    [schemaOptionsBySource, selectedToReference?.source],
  );

  const fromTableOptions = useMemo(() => {
    const key = getTableKey(
      selectedFromSource?.source,
      selectedFromSource?.schema,
    );
    const tableNames = key ? (tablesBySourceSchema[key] ?? []) : [];

    return tableNames.map((name) => ({
      label: name,
      value: name,
    }));
  }, [
    selectedFromSource?.schema,
    selectedFromSource?.source,
    tablesBySourceSchema,
  ]);

  const toSourceTableNames = useMemo(() => {
    const key = getTableKey(
      selectedToReference?.source,
      selectedToReference?.schema,
    );

    return key ? [...(tablesBySourceSchema[key] ?? [])] : [];
  }, [
    selectedToReference?.schema,
    selectedToReference?.source,
    tablesBySourceSchema,
  ]);

  const toTableOptions = useMemo(() => {
    const tableNames = [...toSourceTableNames];
    const currentSelection = selectedToReference?.table;

    if (
      currentSelection &&
      !tableNames.includes(currentSelection) &&
      currentSelection.length > 0
    ) {
      tableNames.unshift(currentSelection);
    }

    return tableNames.map((name) => ({
      label: name,
      value: name,
    }));
  }, [toSourceTableNames, selectedToReference?.table]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (shouldSkipAutoSelection) {
      return;
    }

    const toSource = selectedToReference?.source;

    if (!toSource) {
      return;
    }

    const availableSchemas = schemaOptionsBySource[toSource] ?? [];

    if (
      availableSchemas.length > 0 &&
      (!selectedToReference?.schema ||
        !availableSchemas.includes(selectedToReference.schema))
    ) {
      form.setValue('toReference.schema', availableSchemas[0], {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [
    form,
    open,
    schemaOptionsBySource,
    selectedToReference?.schema,
    selectedToReference?.source,
    shouldSkipAutoSelection,
  ]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (shouldSkipAutoSelection) {
      return;
    }

    const availableTables = toSourceTableNames;

    if (
      availableTables.length > 0 &&
      (!selectedToReference?.table ||
        !availableTables.includes(selectedToReference.table))
    ) {
      form.setValue('toReference.table', availableTables[0], {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  }, [
    form,
    open,
    selectedToReference?.table,
    shouldSkipAutoSelection,
    toSourceTableNames,
  ]);

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

  const tableColumnsForRemoteSchemaDialog = useMemo(
    () =>
      (fromTableData?.columns as NormalizedQueryDataRow[] | undefined) ?? [],
    [fromTableData?.columns],
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

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !initialValues) {
      form.reset();
    }

    setOpen(nextOpen);
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!selectedRemoteSchemaFromToSource) {
      return;
    }

    // Prevent table queries from running with a non-database source.
    form.setValue('toReference.schema', '', { shouldDirty: true });
    form.setValue('toReference.table', '', { shouldDirty: true });

    setDefaultRemoteSchema(selectedRemoteSchemaFromToSource);
    setShowCreateRemoteSchemaRelationshipDialog(true);
    if (!initialValues) {
      form.reset();
    }
    setOpen(false);
  }, [form, initialValues, open, selectedRemoteSchemaFromToSource, setOpen]);

  const remoteSchemaSelectItems = useMemo(() => {
    if (remoteSchemasStatus === 'loading') {
      return (
        <>
          <SelectSeparator />
          <SelectItem disabled value="__remote-schemas-loading">
            Loading remote schemas...
          </SelectItem>
        </>
      );
    }

    if (!remoteSchemas?.length) {
      return null;
    }

    return (
      <>
        <SelectSeparator />
        <SelectItem disabled value="__remote-schemas-label">
          Remote schemas
        </SelectItem>
        {remoteSchemas.map((remoteSchema) => (
          <SelectItem
            key={`to-remote-schema-${remoteSchema.name}`}
            value={`${REMOTE_SCHEMA_PREFIX}${remoteSchema.name}`}
          >
            Remote schema: {remoteSchema.name}
          </SelectItem>
        ))}
      </>
    );
  }, [REMOTE_SCHEMA_PREFIX, remoteSchemas, remoteSchemasStatus]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="sm:max-w-[720px]"
          hideCloseButton
          disableOutsideClick={isSubmittingRelationship}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (values) => {
                await onSubmitRelationship(values);
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
                <div className="flex flex-1 flex-col gap-4 rounded-md border p-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    From Source
                  </h3>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormSelect
                        control={form.control}
                        name="fromSource.source"
                        label="Source"
                        placeholder="Select source"
                        containerClassName="w-full"
                        disabled
                      >
                        {sourceOptions.map((option) => (
                          <SelectItem
                            key={`from-source-${option}`}
                            value={option}
                          >
                            {option}
                          </SelectItem>
                        ))}
                        {sourceOptions.length === 0 && (
                          <SelectItem disabled value="__no-from-sources">
                            No sources available
                          </SelectItem>
                        )}
                      </FormSelect>

                      <FormSelect
                        control={form.control}
                        name="fromSource.schema"
                        label="Schema"
                        placeholder="Select schema"
                        containerClassName="w-full"
                        disabled
                      >
                        {fromSchemaOptions.map((option) => (
                          <SelectItem
                            key={`from-schema-${option}`}
                            value={option}
                          >
                            {option}
                          </SelectItem>
                        ))}
                        {fromSchemaOptions.length === 0 && (
                          <SelectItem disabled value="__no-from-schemas">
                            No schemas available
                          </SelectItem>
                        )}
                      </FormSelect>
                    </div>

                    <FormCombobox<RelationshipFormValues>
                      control={form.control}
                      name="fromSource.table"
                      label="Table"
                      placeholder="Select table"
                      options={fromTableOptions}
                      disabled
                      searchPlaceholder="Search table..."
                      emptyText="No tables found."
                    />
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-4 rounded-md border p-4">
                  <h3 className="text-sm font-semibold text-foreground">
                    To Reference
                  </h3>

                  <div className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormSelect
                        control={form.control}
                        name="toReference.source"
                        label="Source"
                        placeholder="Select source"
                        containerClassName="w-full"
                      >
                        {sourceOptions.map((option) => (
                          <SelectItem
                            key={`to-source-${option}`}
                            value={option}
                          >
                            {option}
                          </SelectItem>
                        ))}
                        {remoteSchemaSelectItems}
                        {sourceOptions.length === 0 && (
                          <SelectItem disabled value="__no-to-sources">
                            No sources available
                          </SelectItem>
                        )}
                      </FormSelect>

                      <FormSelect
                        control={form.control}
                        name="toReference.schema"
                        label="Schema"
                        placeholder="Select schema"
                        containerClassName="w-full"
                        disabled={!selectedToReference?.source}
                      >
                        {toSchemaOptions.map((option) => (
                          <SelectItem
                            key={`to-schema-${option}`}
                            value={option}
                          >
                            {option}
                          </SelectItem>
                        ))}
                        {toSchemaOptions.length === 0 && (
                          <SelectItem disabled value="__no-to-schemas">
                            No schemas available
                          </SelectItem>
                        )}
                      </FormSelect>
                    </div>

                    <FormCombobox<RelationshipFormValues>
                      control={form.control}
                      name="toReference.table"
                      label="Table"
                      placeholder="Select table"
                      options={toTableOptions}
                      disabled={!selectedToReference?.schema}
                      searchPlaceholder="Search table..."
                      emptyText="No tables found."
                    />
                  </div>
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
                  loading={isSubmittingRelationship}
                  disabled={isSubmittingRelationship}
                  className="!text-sm+"
                >
                  {submitButtonText}
                </ButtonWithLoading>
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className="!text-sm+ text-foreground"
                  >
                    Cancel
                  </Button>
                </DialogClose>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <EditRemoteSchemaRelationshipDialogControlled
        open={showCreateRemoteSchemaRelationshipDialog}
        setOpen={setShowCreateRemoteSchemaRelationshipDialog}
        schema={schema}
        tableName={tableName}
        source={source}
        relationship={null}
        tableColumns={tableColumnsForRemoteSchemaDialog}
        defaultRemoteSchema={defaultRemoteSchema}
        onSuccess={onSuccess}
      />
    </>
  );
}
