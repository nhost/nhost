import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormSelect } from '@/components/form/FormSelect';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { SelectItem } from '@/components/ui/v3/select';
import ReferencedColumnSelect from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/ReferencedColumnSelect';
import ReferencedSchemaSelect from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/ReferencedSchemaSelect';
import ReferencedTableSelect from '@/features/orgs/projects/database/dataGrid/components/BaseForeignKeyForm/ReferencedTableSelect';
import { useDatabaseQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useDatabaseQuery';
import type {
  DatabaseColumn,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getSingularForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/utils/extractForeignKeyRelation';
import type { DialogFormProps } from '@/types/common';

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
  /**
   * Determines whether or not the origin column selector should be disabled.
   */
  disableOriginColumn?: boolean;
}

export const baseForeignKeyValidationSchema = Yup.object().shape({
  id: Yup.string(),
  name: Yup.string(),
  columns: Yup.array()
    .of(Yup.string().required('This field is required.'))
    .length(1)
    .required(),
  referencedSchema: Yup.string().nullable().required('This field is required.'),
  referencedTable: Yup.string().nullable().required('This field is required.'),
  referencedColumns: Yup.array()
    .of(Yup.string().required('This field is required.'))
    .length(1)
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

export default function BaseForeignKeyForm({
  availableColumns,
  onSubmit: handleExternalSubmit,
  onCancel,
  submitButtonText = 'Save',
  disableOriginColumn,
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
      onSubmit={(values) => {
        const relation = values as ForeignKeyRelation;
        const singularRelation = getSingularForeignKeyRelation(relation);

        if (!singularRelation) {
          return undefined;
        }

        const selectedColumn = availableColumns?.find(
          (column) => column.name === singularRelation.localColumn,
        );
        return handleExternalSubmit({
          ...relation,
          oneToOne:
            selectedColumn?.isPrimary || selectedColumn?.isUnique || false,
        });
      }}
      className="flex flex-auto flex-col content-between overflow-hidden pb-4"
    >
      <div className="grid flex-auto grid-flow-row gap-4 overflow-y-auto border-t-1 py-4">
        <section className="grid grid-flow-row gap-4 px-6">
          <h3 className="font-semibold text-foreground text-lg leading-6">
            From
          </h3>

          <FormSelect
            control={control}
            name="columns.0"
            label="Column"
            placeholder="Select a column"
            autoFocus={!disableOriginColumn}
            disabled={disableOriginColumn}
            contentClassName="z-[1400]"
          >
            {availableColumns
              ?.filter(({ name }) => Boolean(name))
              .map(({ name }) => (
                <SelectItem value={name} key={name}>
                  {name}
                </SelectItem>
              ))}
          </FormSelect>
        </section>

        <hr className="border-t-1" />

        <section className="grid grid-flow-row gap-4 px-6">
          <h3 className="font-semibold text-foreground text-lg leading-6">
            To
          </h3>

          <ReferencedSchemaSelect
            options={schemas}
            autoFocus={disableOriginColumn}
          />
          <ReferencedTableSelect options={tables} />
          <ReferencedColumnSelect />
        </section>

        <hr className="border-t-1" />

        <section className="grid grid-cols-2 gap-4 px-6">
          <FormSelect
            control={control}
            name="updateAction"
            label="On Update"
            containerClassName="col-span-1"
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
