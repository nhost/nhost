import { type MouseEvent, useEffect, useState } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import type {
  DatabaseTable,
  ForeignKeyRelation,
  FormUniqueConstraint,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRESQL_MAX_IDENTIFIER_LENGTH } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants/postgresqlConstants';
import type { DialogFormProps } from '@/types/common';
import { areUniqueConstraintsValid } from '@/features/orgs/projects/database/dataGrid/components/BaseTableForm/uniqueConstraintValidation';
import ColumnEditorTable from './ColumnEditorTable';
import ForeignKeyEditorSection from './ForeignKeyEditorSection';
import IdentityColumnSelect from './IdentityColumnSelect';
import PrimaryKeySelect from './PrimaryKeySelect';
import TableObjectsSection from './TableObjectsSection';
import UniqueConstraintEditorSection from './UniqueConstraintEditorSection';

export interface BaseTableFormValues
  extends Omit<
    DatabaseTable,
    | 'primaryKey'
    | 'identityColumn'
    | 'uniqueConstraints'
    | 'originalUniqueConstraints'
  > {
  /**
   * The indices of the primary key columns.
   */
  primaryKeyIndices: string[];
  /**
   * The index of the identity column.
   */
  identityColumnIndex?: number | null;
  /**
   * Foreign keys of the table.
   */
  foreignKeyRelations?: ForeignKeyRelation[];
  /** Canonical form UNIQUE constraints using stable column references. */
  uniqueConstraints: FormUniqueConstraint[];
}

export interface BaseTableFormProps extends DialogFormProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: BaseTableFormValues) => Promise<void>;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: (event?: MouseEvent<HTMLButtonElement>) => void;
  /**
   * Submit button text.
   *
   * @default 'Save'
   */
  submitButtonText?: string;
  /**
   * Schema where the table is located. When provided together with
   * `tableName`, the table objects section (constraints, indexes, triggers)
   * is rendered.
   */
  schema?: string;
  /**
   * Name of the table being edited.
   */
  tableName?: string;
  /**
   * When provided together with `onSchemaChange`, renders a schema selector
   * alongside the table name so the user can pick the target schema.
   */
  availableSchemas?: string[];
  /**
   * Called when the user picks a new schema. Requires `availableSchemas`.
   */
  onSchemaChange?: (schema: string) => void;
  /** Primary key / unique constraint column sets, forwarded to the foreign key dialogs. */
  constraintColumnSets?: string[][];
}

export const baseColumnValidationSchema = Yup.object().shape({
  name: Yup.string()
    .required('This field is required.')
    .matches(
      /^([A-Za-z]|_)+/i,
      'Column name must start with a letter or underscore.',
    )
    .matches(
      /^\w+$/i,
      'Column name must contain only letters, numbers, or underscores.',
    )
    .max(
      POSTGRESQL_MAX_IDENTIFIER_LENGTH,
      `Column name must be at most ${POSTGRESQL_MAX_IDENTIFIER_LENGTH} characters.`,
    ),
  type: Yup.string().required('This field is required.').nullable(),
});

export const baseTableValidationSchema = Yup.object({
  name: Yup.string()
    .required('This field is required.')
    .matches(
      /^([A-Za-z]|_)+/i,
      'Table name must start with a letter or underscore.',
    )
    .matches(
      /^\w+$/i,
      'Table name must contain only letters, numbers, or underscores.',
    )
    .max(
      POSTGRESQL_MAX_IDENTIFIER_LENGTH,
      `Table name must be at most ${POSTGRESQL_MAX_IDENTIFIER_LENGTH} characters.`,
    ),
  columns: Yup.array()
    .of(baseColumnValidationSchema)
    .test({
      message: 'At least one column is required.',
      test: (columns) => (columns?.length ?? 0) > 0,
    })
    .test({
      message: 'The table must contain only unique column names.',
      test: (columns) =>
        new Set(columns?.map(({ name }) => name)).size === columns?.length,
    }),
  primaryKeyIndices: Yup.array().of(Yup.string()),
  identityColumnIndex: Yup.number().nullable(),
  uniqueConstraints: Yup.array()
    .of(
      Yup.object({
        id: Yup.string().required(),
        originalName: Yup.string().optional(),
        name: Yup.string().optional(),
        columnReferences: Yup.array().of(Yup.string().required()).required(),
      }),
    )
    .test(
      'valid-unique-constraints',
      'Every UNIQUE constraint must have a valid name and at least one existing, distinct column.',
      function validateUniqueConstraints(constraints) {
        const columns = this.parent.columns ?? [];
        const columnReferences = new Set<string>(
          columns.flatMap(
            ({ formReference }: { formReference?: string }) =>
              formReference ? [formReference] : [],
          ),
        );

        return areUniqueConstraintsValid(
          constraints ?? [],
          columnReferences,
        );
      },
    ),
});

function NameInput() {
  const { control } = useFormContext<BaseTableFormValues>();

  return (
    <FormInput
      control={control}
      name="name"
      label="Name"
      inline
      autoComplete="off"
      className="border-border"
      containerClassName="col-span-8"
      data-testid="tableNameInput"
    />
  );
}

const DIRTY_SOURCE_ID = 'base-table-form';

const ACCORDION_SECTION_VALUES = [
  'columns',
  'foreignKeys',
  'uniqueConstraints',
  'constraints',
  'indexes',
  'triggers',
];

function FormFooter({
  onCancel,
  submitButtonText,
  onSubmitClick,
}: Pick<BaseTableFormProps, 'onCancel' | 'submitButtonText'> & {
  onSubmitClick?: VoidFunction;
}) {
  const { isSubmitting } = useFormState();

  return (
    <div className="box grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 p-2">
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>

      <ButtonWithLoading
        loading={isSubmitting}
        disabled={isSubmitting}
        type="submit"
        className="justify-self-end"
        onClick={onSubmitClick}
      >
        {submitButtonText}
      </ButtonWithLoading>
    </div>
  );
}

export default function BaseTableForm({
  location,
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
  schema,
  tableName,
  availableSchemas,
  onSchemaChange,
  constraintColumnSets,
}: BaseTableFormProps) {
  const [openSections, setOpenSections] = useState<string[]>([
    'columns',
    'uniqueConstraints',
    'foreignKeys',
  ]);
  const { setDirtySource } = useDialog();
  const { subscribe } = useFormContext();

  useEffect(() => {
    const unsubscribe = subscribe({
      formState: { isDirty: true },
      callback: ({ isDirty }) => {
        setDirtySource(DIRTY_SOURCE_ID, Boolean(isDirty), location);
      },
    });
    return () => {
      unsubscribe();
    };
  }, [subscribe, setDirtySource, location]);

  const showSchemaPicker =
    !!onSchemaChange && !!availableSchemas && availableSchemas.length > 0;

  return (
    <Form
      onSubmit={onSubmit}
      className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
    >
      <div className="flex-auto overflow-y-auto pb-4">
        {showSchemaPicker && (
          <section className="grid grid-cols-8 items-center gap-2 px-6 py-3">
            <label htmlFor="schema" className="col-span-2 font-medium text-sm">
              Schema
            </label>
            <div className="col-span-6">
              <Select value={schema ?? ''} onValueChange={onSchemaChange}>
                <SelectTrigger id="schema" className="h-10 w-full">
                  <SelectValue placeholder="Select schema" />
                </SelectTrigger>
                <SelectContent>
                  {availableSchemas?.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>
        )}
        <section className="grid grid-cols-8 px-6 py-3">
          <NameInput />
        </section>

        <Accordion
          type="multiple"
          value={openSections}
          onValueChange={setOpenSections}
          className="border-t-1"
        >
          <AccordionItem value="columns">
            <AccordionTrigger className="px-6 py-2 text-lg">
              Columns
            </AccordionTrigger>
            <AccordionContent className="px-6 pb-3" forceMount>
              <div className="">
                <ColumnEditorTable />
                <PrimaryKeySelect />
                <IdentityColumnSelect />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="uniqueConstraints">
            <AccordionTrigger className="px-6 py-2 text-lg">
              Unique Constraints
            </AccordionTrigger>
            <AccordionContent className="pb-3" forceMount>
              <UniqueConstraintEditorSection />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="foreignKeys">
            <AccordionTrigger className="px-6 py-2 text-lg">
              Foreign Keys
            </AccordionTrigger>
            <AccordionContent className="pb-3" forceMount>
              <ForeignKeyEditorSection
                constraintColumnSets={constraintColumnSets}
              />
            </AccordionContent>
          </AccordionItem>

          {schema && tableName && (
            <TableObjectsSection schema={schema} table={tableName} />
          )}
        </Accordion>
      </div>

      <FormFooter
        onCancel={onCancel}
        submitButtonText={submitButtonText}
        onSubmitClick={() => setOpenSections([...ACCORDION_SECTION_VALUES])}
      />
    </Form>
  );
}
