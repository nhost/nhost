import { useEffect, useState } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import type {
  DatabaseTable,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { DialogFormProps } from '@/types/common';
import ColumnEditorTable from './ColumnEditorTable';
import ForeignKeyEditorSection from './ForeignKeyEditorSection';
import IdentityColumnSelect from './IdentityColumnSelect';
import PrimaryKeySelect from './PrimaryKeySelect';
import TableObjectsSection from './TableObjectsSection';

export interface BaseTableFormValues
  extends Omit<DatabaseTable, 'primaryKey' | 'identityColumn'> {
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
}

export interface BaseTableFormProps extends DialogFormProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: BaseTableFormValues) => Promise<void>;
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
   * Schema where the table is located. When provided together with
   * `tableName`, the table objects section (constraints, indexes, triggers)
   * is rendered.
   */
  schema?: string;
  /**
   * Name of the table being edited.
   */
  tableName?: string;
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
    ),
  type: Yup.object()
    .shape({ value: Yup.string().required() })
    .required('This field is required.')
    .nullable(),
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
});

function NameInput() {
  const { register } = useFormContext();
  const { errors } = useFormState({ name: 'name' });

  return (
    <Input
      {...register('name')}
      id="name"
      fullWidth
      inputProps={{
        'data-testid': 'tableNameInput',
      }}
      label="Name"
      helperText={
        typeof errors.name?.message === 'string' ? errors.name?.message : ''
      }
      hideEmptyHelperText
      error={Boolean(errors.name)}
      variant="inline"
      className="col-span-8 py-3"
      autoComplete="off"
      autoFocus
    />
  );
}

const ACCORDION_SECTION_VALUES = [
  'columns',
  'foreignKeys',
  'constraints',
  'indexes',
  'triggers',
];

function FormFooter({
  onCancel,
  submitButtonText,
  location,
  onSubmitClick,
}: Pick<BaseTableFormProps, 'onCancel' | 'submitButtonText'> &
  Pick<DialogFormProps, 'location'> & { onSubmitClick?: VoidFunction }) {
  const { onDirtyStateChange } = useDialog();
  const { isSubmitting, dirtyFields } = useFormState();

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  return (
    <Box className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 p-2">
      <Button
        variant="borderless"
        color="secondary"
        onClick={onCancel}
        tabIndex={isDirty ? -1 : 0}
      >
        Cancel
      </Button>

      <Button
        loading={isSubmitting}
        disabled={isSubmitting}
        type="submit"
        className="justify-self-end"
        onClick={onSubmitClick}
      >
        {submitButtonText}
      </Button>
    </Box>
  );
}

export default function BaseTableForm({
  location,
  onSubmit,
  onCancel,
  submitButtonText = 'Save',
  schema,
  tableName,
}: BaseTableFormProps) {
  const [openSections, setOpenSections] = useState<string[]>([
    'columns',
    'foreignKeys',
  ]);

  return (
    <Form
      onSubmit={onSubmit}
      className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
    >
      <div className="flex-auto overflow-y-auto pb-4">
        <Box component="section" className="grid grid-cols-8 px-6 py-3">
          <NameInput />
        </Box>

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
              <div className="grid grid-cols-8">
                <ColumnEditorTable />
                <PrimaryKeySelect />
                <IdentityColumnSelect />
              </div>
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="foreignKeys">
            <AccordionTrigger className="px-6 py-2 text-lg">
              Foreign Keys
            </AccordionTrigger>
            <AccordionContent className="pb-3" forceMount>
              <ForeignKeyEditorSection />
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
        location={location}
        onSubmitClick={() => setOpenSections([...ACCORDION_SECTION_VALUES])}
      />
    </Form>
  );
}
