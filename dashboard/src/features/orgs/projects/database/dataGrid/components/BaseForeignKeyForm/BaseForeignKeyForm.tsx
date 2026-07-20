import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
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
import ColumnMappingRow from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/ColumnMappingRow';
import ReferencedKeySelect from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/ReferencedKeySelect';
import ReferencedSchemaSelect from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/ReferencedSchemaSelect';
import ReferencedTableSelect from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/ReferencedTableSelect';
import resolveExistingReferencedTarget from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/resolveExistingReferencedTarget';

export type BaseForeignKeyFormValues = ForeignKeyRelation;

export interface BaseForeignKeyFormProps extends DialogFormProps {
  availableColumns?: DatabaseColumn[];
  constraintColumnSets?: string[][];
  existingForeignKey?: ForeignKeyRelation;
  onSubmit: (values: ForeignKeyRelation) => Promise<void>;
  onCancel?: VoidFunction;
  submitButtonText?: string;
}

export const baseForeignKeyValidationSchema = Yup.object().shape({
  id: Yup.string(),
  name: Yup.string(),
  referencedSchema: Yup.string().nullable().required('This field is required.'),
  referencedTable: Yup.string().nullable().required('This field is required.'),
  referencedKeyId: Yup.string().required('Select a referenced key.'),
  targetMode: Yup.string().oneOf(['candidate', 'legacy']).required(),
  preserveReferencedOrder: Yup.boolean().required(),
  legacyLabel: Yup.string(),
  columnMappings: Yup.array()
    .of(
      Yup.object().shape({
        column: Yup.string().nullable().required('This field is required.'),
        referencedColumn: Yup.string()
          .nullable()
          .required('This field is required.'),
      }),
    )
    .min(1, 'Select a referenced key.')
    .test('distinct-local-columns', 'Select distinct local columns.', (mappings) => {
      const columns = mappings?.map(({ column }) => column).filter(Boolean) ?? [];
      return new Set(columns).size === columns.length;
    })
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

const DIRTY_SOURCE_ID = 'base-foreign-keyform';

function hasSameColumns(left: string[], right: string[]) {
  return (
    left.length === right.length &&
    left.every((column) => right.includes(column))
  );
}

export default function BaseForeignKeyForm({
  availableColumns,
  constraintColumnSets,
  existingForeignKey,
  onSubmit: handleExternalSubmit,
  onCancel,
  submitButtonText = 'Save',
  location,
}: BaseForeignKeyFormProps) {
  const { setDirtySource } = useDialog();
  const router = useRouter();
  const {
    query: { dataSourceSlug },
  } = router;
  const form = useFormContext<BaseForeignKeySchemaValues>();
  const { control, setValue, subscribe, formState, setError } = form;
  const { isSubmitting } = formState;
  const initializedExistingTarget = useRef(false);

  const { data } = useDatabaseQuery([dataSourceSlug]);
  const schemas = data?.schemas ?? [];
  const tables = data?.tableLikeObjects ?? [];
  const referencedSchema = useWatch({ control, name: 'referencedSchema' });
  const referencedTable = useWatch({ control, name: 'referencedTable' });
  const targetMode = useWatch({ control, name: 'targetMode' });

  const {
    data: referencedTableData,
    status: referencedColumnsStatus,
    isPreviousData,
  } = useTableSchemaQuery([`${referencedSchema}.${referencedTable}`], {
    schema: referencedSchema,
    table: referencedTable,
    queryOptions: { enabled: !!referencedSchema && !!referencedTable },
  });

  const genuineCandidates = useMemo(
    () =>
      isPreviousData
        ? []
        : (referencedTableData?.candidateKeys ?? []).filter(
            ({ kind }) => kind !== 'standaloneUniqueIndex',
          ),
    [isPreviousData, referencedTableData],
  );

  useEffect(() => {
    if (
      !existingForeignKey ||
      initializedExistingTarget.current ||
      isPreviousData ||
      referencedColumnsStatus !== 'success'
    ) {
      return;
    }

    const resolution = resolveExistingReferencedTarget(
      existingForeignKey.referencedColumns,
      referencedTableData?.candidateKeys ?? [],
    );

    if (resolution.mode === 'candidate') {
      setValue('referencedKeyId', resolution.candidate.id);
      setValue('targetMode', 'candidate');
    } else {
      setValue('referencedKeyId', 'legacy');
      setValue('targetMode', 'legacy');
      setValue('legacyLabel', resolution.label);
    }
    initializedExistingTarget.current = true;
  }, [
    existingForeignKey,
    genuineCandidates,
    isPreviousData,
    referencedColumnsStatus,
    referencedTableData,
    setValue,
  ]);

  useEffect(() => {
    const unsubscribe = subscribe({
      formState: { isDirty: true },
      callback: ({ isDirty: isDirtyNext }) => {
        setDirtySource(DIRTY_SOURCE_ID, Boolean(isDirtyNext), location);
      },
    });
    return () => unsubscribe();
  }, [subscribe, setDirtySource, location]);

  function resetTarget() {
    initializedExistingTarget.current = true;
    setValue('referencedKeyId', '', { shouldDirty: true });
    setValue('targetMode', 'candidate', { shouldDirty: true });
    setValue('preserveReferencedOrder', false);
    setValue('legacyLabel', undefined);
    setValue('columnMappings', [], { shouldDirty: true });
  }

  function selectTarget(keyId: string) {
    const candidate = genuineCandidates.find(({ id }) => id === keyId);
    if (!candidate) return;
    setValue('targetMode', 'candidate', { shouldDirty: true });
    setValue('preserveReferencedOrder', false, { shouldDirty: true });
    setValue(
      'columnMappings',
      candidate.columns.map((referencedColumn) => ({
        column: '',
        referencedColumn,
      })),
      { shouldDirty: true },
    );
  }

  const columnMappings = useWatch({ control, name: 'columnMappings' }) ?? [];
  const selectedColumns = new Set(
    columnMappings.map(({ column }) => column).filter(Boolean) as string[],
  );
  const hasReferencedTable = !!referencedSchema && !!referencedTable;
  const noCandidateKeys =
    hasReferencedTable &&
    referencedColumnsStatus === 'success' &&
    !isPreviousData &&
    genuineCandidates.length === 0 &&
    targetMode !== 'legacy';
  const legacyLabel = useWatch({ control, name: 'legacyLabel' });

  return (
    <Form
      onSubmit={(values) => {
        const selectedCandidate = genuineCandidates.find(
          ({ id }) => id === values.referencedKeyId,
        );
        const referencedColumns = values.columnMappings.map(
          ({ referencedColumn }) => referencedColumn ?? '',
        );
        if (
          values.targetMode === 'candidate' &&
          (!selectedCandidate ||
            (values.preserveReferencedOrder
              ? !hasSameColumns(selectedCandidate.columns, referencedColumns)
              : !selectedCandidate.columns.every(
                  (column, index) => column === referencedColumns[index],
                )))
        ) {
          setError('referencedKeyId', {
            message: 'Select a current referenced key.',
          });
          return;
        }

        const columns = values.columnMappings.map(({ column }) => column ?? '');
        const oneToOneColumns = constraintColumnSets
          ? (availableColumns ?? []).map(({ name, isPrimary }) => ({
              name,
              isPrimary,
            }))
          : (availableColumns ?? []);

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
            columns: oneToOneColumns,
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
            onReferenceChange={resetTarget}
          />
          <ReferencedTableSelect options={tables} onReferenceChange={resetTarget} />
          <ReferencedKeySelect
            options={genuineCandidates}
            legacyLabel={targetMode === 'legacy' ? legacyLabel : undefined}
            disabled={!hasReferencedTable || isPreviousData}
            onKeyChange={selectTarget}
          />
          {noCandidateKeys && (
            <p className="m-0 text-muted-foreground text-xs">
              This table has no primary key or UNIQUE constraint.
            </p>
          )}
        </section>

        <hr className="border-t-1" />

        <section className="grid max-h-72 grid-flow-row gap-2 overflow-y-auto px-6">
          {columnMappings.length > 0 && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span className="font-medium text-foreground text-sm">Column</span>
              <span className="w-4" aria-hidden />
              <span className="font-medium text-foreground text-sm">References</span>
            </div>
          )}
          {columnMappings.map((mapping, index) => (
            <ColumnMappingRow
              key={`${mapping.referencedColumn}-${index}`}
              index={index}
              availableColumns={availableColumns}
              selectedColumns={selectedColumns}
            />
          ))}
        </section>

        <hr className="border-t-1" />

        <section className="grid grid-cols-2 gap-4 px-6">
          <FormSelect control={control} name="updateAction" label="On Update" containerClassName="col-span-1" className="border-border" contentClassName="z-[1400]">
            <SelectItem value="RESTRICT">RESTRICT</SelectItem>
            <SelectItem value="CASCADE">CASCADE</SelectItem>
            <SelectItem value="SET NULL">SET NULL</SelectItem>
            <SelectItem value="SET DEFAULT">SET DEFAULT</SelectItem>
            <SelectItem value="NO ACTION">NO ACTION</SelectItem>
          </FormSelect>
          <FormSelect control={control} name="deleteAction" label="On Delete" containerClassName="col-span-1" className="border-border" contentClassName="z-[1400]">
            <SelectItem value="RESTRICT">RESTRICT</SelectItem>
            <SelectItem value="CASCADE">CASCADE</SelectItem>
            <SelectItem value="SET NULL">SET NULL</SelectItem>
            <SelectItem value="SET DEFAULT">SET DEFAULT</SelectItem>
            <SelectItem value="NO ACTION">NO ACTION</SelectItem>
          </FormSelect>
        </section>
      </div>

      <div className="grid flex-shrink-0 grid-flow-row gap-2 border-t-1 px-6 pt-4">
        <ButtonWithLoading loading={isSubmitting} disabled={isSubmitting} type="submit" data-testid="foreignKeyFormSubmitButton">
          {submitButtonText}
        </ButtonWithLoading>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </Form>
  );
}
