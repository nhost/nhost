import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormSelect } from '@/components/form/FormSelect';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { SelectItem } from '@/components/ui/v3/select';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import type {
  DatabaseColumn,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { computeForeignKeyOneToOne } from '@/features/orgs/projects/database/dataGrid/utils/computeForeignKeyOneToOne';
import { getCandidateKeyColumnSets } from '@/features/orgs/projects/database/dataGrid/utils/getCandidateKeyColumnSets';
import type { DialogFormProps } from '@/types/common';
import ReferencedKeySelect from './ReferencedKeySelect';
import ReferencedSchemaSelect from './ReferencedSchemaSelect';
import ReferencedTableSelect from './ReferencedTableSelect';

export type BaseForeignKeyFormValues = ForeignKeyRelation;

export interface BaseForeignKeyFormProps extends DialogFormProps {
  /**
   * Available columns in the table.
   */
  availableColumns?: DatabaseColumn[];
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
  columns: Yup.array()
    .of(Yup.string().required('This field is required.'))
    .min(1, 'This field is required.'),
  referencedSchema: Yup.string().nullable().required('This field is required.'),
  referencedTable: Yup.string().nullable().required('This field is required.'),
  referencedKeyName: Yup.string().required('Select a referenced key.'),
  referencedColumns: Yup.array()
    .of(Yup.string().required('This field is required.'))
    .min(1, 'This field is required.'),
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

export default function BaseForeignKeyForm({
  availableColumns,
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
  const { control, subscribe, formState } = form;
  const { isSubmitting } = formState;

  const { data } = useDatabaseQuery([dataSourceSlug]);

  const schemas = data?.schemas ?? [];
  const tables = data?.tableLikeObjects ?? [];

  const referencedColumns: string[] =
    useWatch({ name: 'referencedColumns' }) ?? [];
  const selectedColumns: string[] = useWatch({ name: 'columns' }) ?? [];

  useEffect(() => {
    const unsubscribe = subscribe({
      formState: { isDirty: true },
      callback: ({ isDirty: isDirtyNext }) => {
        setDirtySource(DIRTY_SOURCE_ID, Boolean(isDirtyNext), location);
      },
    });

    return () => unsubscribe();
  }, [subscribe, setDirtySource, location]);

  return (
    <Form
      onSubmit={({ referencedKeyName, ...values }) =>
        handleExternalSubmit({
          ...values,
          oneToOne: computeForeignKeyOneToOne(
            values.columns,
            getCandidateKeyColumnSets(availableColumns),
          ),
        })
      }
      className="flex flex-auto flex-col content-between overflow-hidden pb-4"
    >
      <div className="grid flex-auto grid-flow-row gap-4 overflow-y-auto border-t-1 py-4">
        <section className="grid grid-flow-row gap-4 px-6">
          <h3 className="font-semibold text-foreground text-lg leading-6">
            References
          </h3>

          <ReferencedSchemaSelect options={schemas} autoFocus />
          <ReferencedTableSelect options={tables} />
          <ReferencedKeySelect />
        </section>
        <hr className="border-t-1" />
        <section className="grid grid-flow-row gap-2 px-6 py-2">
          {referencedColumns.length > 0 && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
              <span className="font-medium text-foreground text-sm">
                Column
              </span>
              <span className="w-4" aria-hidden="true" />
              <span className="font-medium text-foreground text-sm">
                References
              </span>
            </div>
          )}

          {referencedColumns.map((referencedColumn, index) => (
            <div
              key={referencedColumn}
              className="grid grid-cols-[1fr_auto_1fr] items-center gap-2"
            >
              <FormSelect
                control={control}
                name={`columns.${index}`}
                label={`Local column for ${referencedColumn}`}
                className="border-border"
                containerClassName="space-y-0 [&>label]:sr-only"
                placeholder="Select a column"
                contentClassName="z-[1400]"
              >
                {availableColumns
                  ?.filter(({ name }) => Boolean(name))
                  .map(({ name }) => (
                    <SelectItem
                      value={name}
                      key={name}
                      disabled={selectedColumns.some(
                        (selected, selectedIndex) =>
                          selected === name && selectedIndex !== index,
                      )}
                    >
                      {name}
                    </SelectItem>
                  ))}
              </FormSelect>

              <ArrowRight className="h-4 w-4 text-muted-foreground" />

              <div className="flex h-10 items-center rounded-md border border-border bg-muted px-3 text-sm">
                {referencedColumn}
              </div>
            </div>
          ))}
        </section>

        <hr className="border-t-1" />

        <section className="grid grid-cols-2 gap-4 px-6">
          <FormSelect
            control={control}
            name="updateAction"
            label="On Update"
            containerClassName="col-span-1"
            contentClassName="z-[1400]"
            className="border-border"
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

        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Form>
  );
}
