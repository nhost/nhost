import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';
import {
  useFieldArray,
  useFormContext,
  useFormState,
  useWatch,
} from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormSelect } from '@/components/form/FormSelect';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { SelectItem } from '@/components/ui/v3/select';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import type {
  DatabaseColumn,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { computeForeignKeyOneToOne } from '@/features/orgs/projects/database/dataGrid/utils/computeForeignKeyOneToOne';
import type { DialogFormProps } from '@/types/common';
import ColumnMappingRow from './ColumnMappingRow';
import ReferencedSchemaSelect from './ReferencedSchemaSelect';
import ReferencedTableSelect from './ReferencedTableSelect';

export type BaseForeignKeyFormValues = ForeignKeyRelation;

export interface BaseForeignKeyFormProps extends DialogFormProps {
  /**
   * Available columns in the table.
   */
  availableColumns?: DatabaseColumn[];
  /**
   * Column sets of the table's primary key / unique constraints. Used to decide
   * whether a composite foreign key is one-to-one. Reconstructed from the
   * fetched schema; absent while creating a table that does not exist yet.
   */
  constraintColumnSets?: string[][];
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: ForeignKeyRelation) => Promise<void>;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Submit button text.
   *
   * @default 'Save'
   */
  submitButtonText?: string;
}

export const baseForeignKeyValidationSchema = Yup.object().shape({
  id: Yup.string(),
  name: Yup.string(),
  referencedSchema: Yup.string().nullable().required('This field is required.'),
  referencedTable: Yup.string().nullable().required('This field is required.'),
  columnMappings: Yup.array()
    .of(
      Yup.object().shape({
        column: Yup.string().nullable().required('This field is required.'),
        referencedColumn: Yup.string()
          .nullable()
          .required('This field is required.'),
      }),
    )
    .min(1, 'Add at least one column pair.')
    .required(),
  updateAction: Yup.string()
    .nullable()
    .required('This field is required.')
    .oneOf(['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT']),
  deleteAction: Yup.string()
    .nullable()
    .required('This field is required.')
    .oneOf(['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT']),
});

export type BaseForeignKeySchemaValues = Yup.InferType<
  typeof baseForeignKeyValidationSchema
>;

export default function BaseForeignKeyForm({
  availableColumns,
  constraintColumnSets,
  onSubmit: handleExternalSubmit,
  onCancel,
  submitButtonText = 'Save',
  location,
}: BaseForeignKeyFormProps) {
  const { onDirtyStateChange } = useDialog();

  const router = useRouter();
  const {
    query: { dataSourceSlug },
  } = router;

  const form = useFormContext<BaseForeignKeySchemaValues>();
  const { control, setValue, getValues } = form;
  const { dirtyFields, isSubmitting } =
    useFormState<BaseForeignKeySchemaValues>();

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'columnMappings',
  });

  const { data } = useDatabaseQuery([dataSourceSlug]);

  const schemas = data?.schemas ?? [];
  const tables = data?.tableLikeObjects ?? [];

  const referencedSchema = useWatch({ control, name: 'referencedSchema' });
  const referencedTable = useWatch({ control, name: 'referencedTable' });

  const { data: referencedTableData, status: referencedColumnsStatus } =
    useTableSchemaQuery([`${referencedSchema}.${referencedTable}`], {
      schema: referencedSchema,
      table: referencedTable,
      queryOptions: { enabled: !!referencedSchema && !!referencedTable },
    });

  const referencedColumnOptions = useMemo(
    () =>
      referencedTableData?.columns.map(
        ({ column_name: columnName }) => columnName,
      ) ?? [],
    [referencedTableData],
  );

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  function resetReferencedColumns() {
    setValue(
      'columnMappings',
      getValues('columnMappings').map((mapping) => ({
        ...mapping,
        referencedColumn: '',
      })),
      { shouldDirty: true },
    );
  }

  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { dirtyFields: true },
      callback: ({ dirtyFields: subscribedDirtyFields }) => {
        onDirtyStateChange(
          Object.keys(subscribedDirtyFields ?? {}).length > 0,
          location,
        );
      },
    });

    return () => unsubscribe();
  }, [form, onDirtyStateChange, location]);

  const hasReferencedTable = !!referencedSchema && !!referencedTable;
  const referencedTableHasNoColumns =
    hasReferencedTable &&
    referencedColumnsStatus === 'success' &&
    referencedColumnOptions.length === 0;

  const columnMappings = useWatch({ control, name: 'columnMappings' }) ?? [];
  const selectedColumns = new Set(
    columnMappings
      .map((mapping) => mapping?.column)
      .filter(Boolean) as string[],
  );
  const selectedReferencedColumns = new Set(
    columnMappings
      .map((mapping) => mapping?.referencedColumn)
      .filter(Boolean) as string[],
  );
  const isAddColumnPairDisabled =
    (availableColumns?.length ?? 0) > 0 &&
    (availableColumns ?? []).every((column) =>
      selectedColumns.has(column.name),
    );

  return (
    <Form
      onSubmit={(values) => {
        const columns = values.columnMappings.map(
          (mapping) => mapping.column ?? '',
        );
        const referencedColumns = values.columnMappings.map(
          (mapping) => mapping.referencedColumn ?? '',
        );

        return handleExternalSubmit({
          id: values.id,
          name: values.name,
          referencedSchema: values.referencedSchema,
          referencedTable: values.referencedTable,
          columns,
          referencedColumns,
          updateAction: values.updateAction,
          deleteAction: values.deleteAction,
          oneToOne: computeForeignKeyOneToOne(columns, {
            columns: availableColumns ?? [],
            constraintColumnSets,
          }),
        });
      }}
      className="flex flex-auto flex-col content-between overflow-hidden pb-4"
    >
      <div className="grid flex-auto grid-flow-row gap-4 overflow-y-auto border-t-1 py-4">
        <section className="grid grid-flow-row gap-4 px-6">
          <h3 className="font-semibold text-foreground text-lg leading-6">
            References
          </h3>

          <ReferencedSchemaSelect
            options={schemas}
            autoFocus
            onReferenceChange={resetReferencedColumns}
          />
          <ReferencedTableSelect
            options={tables}
            onReferenceChange={resetReferencedColumns}
          />
        </section>

        <hr className="border-t-1" />

        <section className="grid max-h-72 grid-flow-row gap-2 overflow-y-auto px-6">
          {fields.length > 0 && (
            <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2">
              <span className="font-medium text-foreground text-sm">
                Column
              </span>
              <span className="w-4" aria-hidden />
              <span className="font-medium text-foreground text-sm">
                References
              </span>
              <span className="w-10" aria-hidden />
            </div>
          )}

          {fields.map((field, index) => (
            <ColumnMappingRow
              key={field.id}
              index={index}
              availableColumns={availableColumns}
              referencedColumnOptions={referencedColumnOptions}
              hasReferencedTable={hasReferencedTable}
              canRemove={fields.length > 1}
              onRemove={() => remove(index)}
              selectedColumns={selectedColumns}
              selectedReferencedColumns={selectedReferencedColumns}
            />
          ))}

          {referencedTableHasNoColumns && (
            <p className="m-0 text-muted-foreground text-xs">
              There are no columns in the {referencedSchema}.{referencedTable}{' '}
              table.
            </p>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-1 gap-2 justify-self-start rounded-sm+ text-primary hover:text-primary"
            disabled={isAddColumnPairDisabled}
            onClick={() => append({ column: '', referencedColumn: '' })}
          >
            <Plus className="h-4 w-4" />
            Add column pair
          </Button>
        </section>

        <hr className="border-t-1" />

        <section className="grid grid-cols-2 gap-4 px-6">
          <FormSelect
            control={control}
            name="updateAction"
            label="On Update"
            containerClassName="col-span-1"
            className="border-border"
            contentClassName="z-[1400]"
          >
            <SelectItem value="RESTRICT">RESTRICT</SelectItem>
            <SelectItem value="CASCADE">CASCADE</SelectItem>
            <SelectItem value="SET NULL">SET NULL</SelectItem>
            <SelectItem value="SET DEFAULT">SET DEFAULT</SelectItem>
            <SelectItem value="NO ACTION">NO ACTION</SelectItem>
          </FormSelect>

          <FormSelect
            control={control}
            name="deleteAction"
            label="On Delete"
            containerClassName="col-span-1"
            className="border-border"
            contentClassName="z-[1400]"
          >
            <SelectItem value="RESTRICT">RESTRICT</SelectItem>
            <SelectItem value="CASCADE">CASCADE</SelectItem>
            <SelectItem value="SET NULL">SET NULL</SelectItem>
            <SelectItem value="SET DEFAULT">SET DEFAULT</SelectItem>
            <SelectItem value="NO ACTION">NO ACTION</SelectItem>
          </FormSelect>
        </section>
      </div>

      <div className="grid flex-shrink-0 grid-flow-row gap-2 border-t-1 px-6 pt-4">
        <ButtonWithLoading
          loading={isSubmitting}
          disabled={isSubmitting}
          type="submit"
          data-testid="foreignKeyFormSubmitButton"
        >
          {submitButtonText}
        </ButtonWithLoading>

        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          tabIndex={isDirty ? -1 : 0}
        >
          Cancel
        </Button>
      </div>
    </Form>
  );
}
