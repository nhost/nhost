import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { FormInput } from '@/components/form/FormInput';
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
import { Form, FormDescription } from '@/components/ui/v3/form';
import { useGetMetadata } from '@/features/orgs/projects/common/hooks/useGetMetadata';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { RemoteField } from '@/utils/hasura-api/generated/schemas';
import {
  type BaseRelationshipFormValues,
  buildDefaultFormValues,
  relationshipFormSchema,
} from './BaseRelationshipFormTypes';
import SourceAndReferenceSelector from './SourceAndReferenceSelector';
import RemoteSchemaRelationshipDetails from './sections/RemoteSchemaRelationshipDetails';
import TableRelationshipDetails from './sections/TableRelationshipDetails';

export interface BaseRelationshipDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  onSuccess?: () => Promise<void> | void;
  /**
   * Source where the relationship is located.
   */
  source: string;
  /**
   * Schema where the relationship is located.
   */
  schema: string;
  /**
   * Table to delete the relationship from.
   */
  tableName: string;
  dialogTitle?: string;
  dialogDescription?: string;
  submitButtonText?: string;
  initialValues?: BaseRelationshipFormValues;
  onSubmit: (values: BaseRelationshipFormValues) => Promise<void>;
}

export type CreateRelationshipFormValues = Extract<
  BaseRelationshipFormValues,
  { referenceKind: 'table' }
>;

export default function BaseRelationshipDialog({
  open,
  setOpen,
  onSuccess,
  dialogTitle = 'Create Relationship',
  dialogDescription = 'Create and track a new relationship in your GraphQL schema.',
  submitButtonText = 'Create Relationship',
  schema,
  tableName,
  source,
  initialValues,
  onSubmit,
}: BaseRelationshipDialogProps) {
  const { data: metadata } = useGetMetadata();

  const form = useForm<BaseRelationshipFormValues>({
    resolver: zodResolver(relationshipFormSchema),
    defaultValues: buildDefaultFormValues(schema, tableName, source),
  });

  const { formState, reset, watch } = form;
  const { isSubmitting } = formState;
  const shouldSkipAutoSelection = Boolean(initialValues) && !formState.isDirty;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialValues) {
      reset(initialValues);
      return;
    }

    const defaultValues = buildDefaultFormValues(source, schema, tableName);

    reset(defaultValues);
  }, [open, reset, initialValues, source, schema, tableName]);

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

  const selectedFromSource = useWatch({
    control: form.control,
    name: 'fromSource',
  });

  const selectedToReference = useWatch({
    control: form.control,
    name: 'toReference',
  });

  const referenceKind = watch('referenceKind');

  const isRemoteSchemaRelationship = referenceKind === 'remoteSchema';

  const selectedRemoteSchemaFromToSource = isRemoteSchemaRelationship
    ? selectedToReference.source
    : null;

  console.log(
    'selectedRemoteSchemaFromToSource',
    selectedRemoteSchemaFromToSource,
  );

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

  useEffect(() => {
    if (!open) {
      return;
    }

    if (shouldSkipAutoSelection) {
      return;
    }

    if (isRemoteSchemaRelationship) {
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
    isRemoteSchemaRelationship,
    open,
    selectedToReference?.table,
    shouldSkipAutoSelection,
    toSourceTableNames,
  ]);

  const { data: fromTableData } = useTableQuery(
    [
      `${selectedFromSource?.source}.${selectedFromSource?.schema}.${selectedFromSource?.table}`,
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

  const tableColumnsForRemoteSchemaDialog = useMemo(
    () =>
      (fromTableData?.columns as NormalizedQueryDataRow[] | undefined) ?? [],
    [fromTableData?.columns],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !initialValues) {
      form.reset();
    }

    setOpen(nextOpen);
  };

  const handleRemoteSchemaRelationshipDetailsChange = useCallback(
    ({
      lhsFields,
      remoteField,
    }: {
      lhsFields: string[];
      remoteField?: RemoteField;
    }) => {
      if (!selectedRemoteSchemaFromToSource) {
        return;
      }

      form.setValue(
        'remoteSchema',
        {
          remoteSchema: selectedRemoteSchemaFromToSource,
          lhsFields,
          remoteField,
        },
        { shouldDirty: true, shouldValidate: true },
      );
    },
    [form, selectedRemoteSchemaFromToSource],
  );

  const formValuesWatch = watch();
  console.log('formValuesWatch', formValuesWatch);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[720px]"
        hideCloseButton
        disableOutsideClick={isSubmitting}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit(values);
              await onSuccess?.();
              setOpen(false);
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

            <SourceAndReferenceSelector />

            <div className="flex flex-col gap-4 rounded-md border p-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-semibold text-foreground">
                  Relationship Details
                </h3>
                <FormDescription>
                  {isRemoteSchemaRelationship
                    ? 'Select the remote schema fields for this relationship.'
                    : 'Select the relationship type and map the columns between the tables.'}
                </FormDescription>
              </div>

              {isRemoteSchemaRelationship &&
              selectedRemoteSchemaFromToSource ? (
                <RemoteSchemaRelationshipDetails
                  remoteSchema={selectedRemoteSchemaFromToSource}
                  tableColumns={tableColumnsForRemoteSchemaDialog}
                  disabled={isSubmitting}
                  onChange={handleRemoteSchemaRelationshipDetailsChange}
                />
              ) : (
                <TableRelationshipDetails />
              )}
            </div>

            <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
              <ButtonWithLoading
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting}
                className="!text-sm+"
              >
                {submitButtonText}
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
