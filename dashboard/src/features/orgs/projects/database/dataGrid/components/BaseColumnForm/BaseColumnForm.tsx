import { useDialog } from '@/components/common/DialogProvider';
import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { ControlledCheckbox } from '@/components/form/ControlledCheckbox';
import { Form } from '@/components/form/Form';
import { InlineCode } from '@/components/presentational/InlineCode';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Input } from '@/components/ui/v2/Input';
import { OptionBase } from '@/components/ui/v2/Option';
import { Text } from '@/components/ui/v2/Text';
import type {
  ColumnType,
  DatabaseColumn,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  identityTypes,
  postgresFunctions,
  postgresTypeGroups,
} from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import type { DialogFormProps } from '@/types/common';
import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import * as Yup from 'yup';
import ForeignKeyEditor from './ForeignKeyEditor';

export type BaseColumnFormValues = DatabaseColumn;

export interface BaseColumnFormProps extends DialogFormProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: BaseColumnFormValues) => Promise<void>;
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
    .nullable()
    .required('This field is required.'),
});

export default function BaseColumnForm({
  onSubmit: handleExternalSubmit,
  onCancel,
  submitButtonText = 'Save',
  location,
}: BaseColumnFormProps) {
  const { onDirtyStateChange } = useDialog();

  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors, isSubmitting, dirtyFields },
  } = useFormContext<BaseColumnFormValues>();

  // Learn more: https://github.com/thundermiracle/mobx-json/issues/46
  const [defaultValueInputText, setDefaultValueInputText] = useState(
    () => watch('defaultValue.label') || '',
  );

  const isIdentity = useWatch({ name: 'isIdentity' });
  const type = useWatch({ name: 'type' });
  const foreignKeyRelation = useWatch({ name: 'foreignKeyRelation' });
  const availableFunctions = (postgresFunctions[type?.value] || []).map(
    (functionName: string) => ({
      label: functionName,
      value: functionName,
    }),
  );

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  return (
    <Form
      onSubmit={handleExternalSubmit}
      className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
    >
      <div className="flex-auto overflow-y-auto">
        <section className="grid grid-cols-8 px-6 py-3">
          <Input
            {...register('name', {
              onChange: (event) => {
                if (foreignKeyRelation) {
                  setValue(`foreignKeyRelation`, {
                    ...foreignKeyRelation,
                    columnName: event.target.value,
                  });
                }
              },
            })}
            id="name"
            fullWidth
            label="Name"
            helperText={errors.name?.message}
            hideEmptyHelperText
            error={Boolean(errors.name)}
            variant="inline"
            className="col-span-8 py-3"
            autoFocus
            autoComplete="off"
          />

          <ControlledAutocomplete
            id="type"
            name="type"
            control={control}
            fullWidth
            placeholder="Select a column type"
            label="Type"
            helperText={errors.type?.message}
            error={Boolean(errors.type)}
            hideEmptyHelperText
            autoHighlight
            className="col-span-8 py-3"
            variant="inline"
            options={postgresTypeGroups}
            groupBy={(option) => option.group}
            onChange={(_event, value) => {
              setDefaultValueInputText('');

              if (
                typeof value !== 'string' &&
                !Array.isArray(value) &&
                !identityTypes.includes(value.value as ColumnType)
              ) {
                setValue('isIdentity', false);
                setValue('defaultValue', null);
              }
            }}
            noOptionsText="No types found"
            renderOption={(props, { label, value }) => (
              <OptionBase {...props}>
                <div className="grid grid-flow-col items-baseline justify-start justify-items-start gap-1.5">
                  <span>{label}</span>

                  <InlineCode>{value}</InlineCode>
                </div>
              </OptionBase>
            )}
          />

          {identityTypes.includes(type?.value) && (
            <ControlledCheckbox
              name="isIdentity"
              label={
                <span className="inline-grid grid-flow-row">
                  <span>Identity</span>
                  <Text
                    component="span"
                    className="text-xs font-normal"
                    color="secondary"
                  >
                    Attach an implicit sequence to the column and make it
                    non-nullable
                  </Text>
                </span>
              }
              className="col-span-8 m-0 w-full py-3 sm:col-span-6 sm:col-start-3 sm:ml-1"
              onChange={(_event, checked) => {
                if (checked) {
                  setDefaultValueInputText('');
                  setValue('defaultValue', null);
                }
              }}
            />
          )}
        </section>

        <Box
          component="section"
          className="grid grid-cols-8 border-t-1 px-6 py-3"
        >
          <ControlledAutocomplete
            id="defaultValue"
            name="defaultValue"
            control={control}
            fullWidth
            freeSolo
            placeholder="NULL"
            label="Default Value"
            inputValue={isIdentity ? '' : defaultValueInputText}
            onInputChange={(_event, value) => setDefaultValueInputText(value)}
            onBlur={(event) => {
              if (
                event.target instanceof HTMLInputElement &&
                !event.target.value
              ) {
                setValue('defaultValue', null);
              }
            }}
            helperText={
              errors.defaultValue?.message ||
              'Can either be a literal or a function'
            }
            onChange={(_event, value) => {
              if (typeof value !== 'string' && !Array.isArray(value)) {
                setDefaultValueInputText(value?.value || '');
              }
            }}
            autoSelect={(filteredOptions) =>
              filteredOptions.length === 0 && defaultValueInputText.length > 0
            }
            slotProps={{
              paper: {
                className: clsx(availableFunctions.length === 0 && 'hidden'),
              },
            }}
            error={Boolean(errors.defaultValue)}
            hideEmptyHelperText
            autoHighlight
            className="col-span-8 py-3"
            variant="inline"
            options={availableFunctions}
            disabled={isIdentity}
            showCustomOption="always"
            customOptionLabel={(optionLabel) =>
              `Use "${optionLabel}" as a literal`
            }
            noOptionsText="Enter a custom default value"
          />

          <ControlledCheckbox
            className="col-span-8 m-0 w-full py-3 sm:col-span-6 sm:col-start-3 sm:ml-1"
            name="isNullable"
            label={
              <span className="inline-grid grid-flow-row">
                <span>Nullable</span>
                <Text
                  component="span"
                  className="text-xs font-normal"
                  color="secondary"
                >
                  Allow the column to assume a NULL value if no value is
                  provided
                </Text>
              </span>
            }
            disabled={isIdentity}
            uncheckWhenDisabled
          />

          <ControlledCheckbox
            className="col-span-8 m-0 w-full py-3 sm:col-span-6 sm:col-start-3 sm:ml-1"
            name="isUnique"
            label={
              <span className="inline-grid grid-flow-row">
                <span>Unique</span>
                <Text
                  component="span"
                  className="text-xs font-normal"
                  color="secondary"
                >
                  Enforce values in the column to be unique across rows
                </Text>
              </span>
            }
            disabled={isIdentity}
            uncheckWhenDisabled
          />

          <ForeignKeyEditor />

          <Input
            {...register('comment')}
            id="comment"
            fullWidth
            multiline
            rows={3}
            label="Comment"
            helperText={errors.comment?.message}
            hideEmptyHelperText
            error={Boolean(errors.comment)}
            variant="inline"
            className="col-span-8 py-3"
            autoComplete="off"
          />
        </Box>
      </div>

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
        >
          {submitButtonText}
        </Button>
      </Box>
    </Form>
  );
}
