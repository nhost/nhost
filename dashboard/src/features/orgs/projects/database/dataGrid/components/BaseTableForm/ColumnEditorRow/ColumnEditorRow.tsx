import {
  ControlledAutocomplete,
  defaultFilterGroupedOptions,
} from '@/components/form/ControlledAutocomplete';
import { ControlledCheckbox } from '@/components/form/ControlledCheckbox';
import { InlineCode } from '@/components/presentational/InlineCode';
import type { CheckboxProps } from '@/components/ui/v2/Checkbox';
import { Input } from '@/components/ui/v2/Input';
import { OptionBase } from '@/components/ui/v2/Option';

import type {
  ColumnType,
  ForeignKeyRelation,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  identityTypes,
  postgresFunctions,
  postgresTypeGroups,
} from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import clsx from 'clsx';

import type { PropsWithoutRef } from 'react';
import { memo, useEffect, useState } from 'react';
import type { FieldError } from 'react-hook-form';
import { useFormContext, useFormState, useWatch } from 'react-hook-form';
import ColumnComment from './ColumnComment';
import { RemoveButton } from './RemoveButton';

export interface FieldArrayInputProps {
  /**
   * Index of the field in the field array.
   */
  index: number;
}

function NameInput({ index }: FieldArrayInputProps) {
  const { register, clearErrors, setValue, getValues } = useFormContext();
  const originalColumnName = getValues(`columns.${index}.name`);
  const foreignKeyRelations = getValues(`foreignKeyRelations`);
  const originalForeignKeyRelationIndex = foreignKeyRelations.findIndex(
    (relation: ForeignKeyRelation) =>
      relation.columnName === originalColumnName,
  );

  const { errors } = useFormState({
    name: [`columns.${index}.name`],
  });

  const primaryKeyIndices: string[] = useWatch({ name: 'primaryKeyIndices' });

  return (
    <Input
      {...register(`columns.${index}.name`, {
        onChange: (event) => {
          if (originalForeignKeyRelationIndex > -1) {
            setValue(
              `foreignKeyRelations.${originalForeignKeyRelationIndex}.columnName`,
              event.target.value,
            );
          }
        },
        onBlur: (event) => {
          if (errors?.columns) {
            clearErrors('columns');
          }

          if (!event.target.value && primaryKeyIndices.includes(`${index}`)) {
            const updatedPrimaryKeyIndices = primaryKeyIndices.filter(
              (pk) => pk !== `${index}`,
            );

            setValue('primaryKeyIndices', updatedPrimaryKeyIndices);
          }
        },
      })}
      autoComplete="off"
      aria-label="Name"
      placeholder="Enter name"
      hideEmptyHelperText
      error={Boolean(errors?.columns?.[index]?.name)}
      helperText={errors?.columns?.[index]?.name?.message}
      inputProps={{ 'data-testid': `columns.${index}.name` }}
    />
  );
}

function TypeAutocomplete({ index }: FieldArrayInputProps) {
  const [inputValue, setInputValue] = useState<string>();
  const { setValue } = useFormContext();
  const { errors } = useFormState({ name: `columns.${index}.type` });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const type = useWatch({ name: `columns.${index}.type` });

  useEffect(() => {
    setInputValue(type?.label ?? '');
  }, [type?.label]);

  return (
    <ControlledAutocomplete
      slotProps={{
        inputRoot: {
          'data-testid': `columns.${index}.type`,
        },
      }}
      id={`columns.${index}.type`}
      name={`columns.${index}.type`}
      aria-label="Type"
      options={postgresTypeGroups}
      groupBy={(option) => option.group ?? ''}
      placeholder="Select type"
      hideEmptyHelperText
      freeSolo
      inputValue={inputValue}
      onInputChange={(_event, value) => {
        // Keep the list scrolled to the top while searching
        requestAnimationFrame(() => {
          const listbox = document.querySelector(
            `[id="columns.${index}.type-listbox"]`,
          );
          if (listbox) {
            listbox.scrollTop = 0;
          }
        });
        setInputValue(value);
      }}
      clearOnBlur
      showCustomOption="first"
      filterOptions={defaultFilterGroupedOptions}
      error={Boolean(errors?.columns?.[index]?.type)}
      helperText={(errors?.columns?.[index]?.type as FieldError)?.message}
      renderOption={(optionProps, { label, value, custom }) => {
        if (custom) {
          return (
            <OptionBase {...optionProps}>
              <span>Use type: &quot;{value}&quot;</span>
            </OptionBase>
          );
        }
        return (
          <OptionBase {...optionProps}>
            <div className="grid grid-flow-col items-baseline justify-start justify-items-start gap-1.5">
              <span>{label}</span>

              <InlineCode>{value}</InlineCode>
            </div>
          </OptionBase>
        );
      }}
      onChange={(_event, value) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          return;
        }

        setValue(`columns.${index}.defaultValue`, null);

        // We need to reset identityColumnIndex if the column
        // that's being edited is the identity column, but its
        // new type is not suitable for identity columns.
        if (
          !identityTypes.includes(value?.value as ColumnType) &&
          identityColumnIndex !== null &&
          typeof identityColumnIndex !== 'undefined' &&
          identityColumnIndex === index
        ) {
          setValue('identityColumnIndex', null);
        }
      }}
    />
  );
}

function DefaultValueAutocomplete({ index }: FieldArrayInputProps) {
  const [inputValue, setInputValue] = useState('');
  const { setValue } = useFormContext();
  const { errors } = useFormState({ name: `columns.${index}.defaultValue` });
  const defaultValue = useWatch({ name: `columns.${index}.defaultValue` });
  const type = useWatch({ name: `columns.${index}.type` });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const isIdentity = identityColumnIndex === index;

  const availableFunctions = (postgresFunctions[type?.value] || []).map(
    (functionName: string) => ({
      label: functionName,
      value: functionName,
    }),
  );

  useEffect(() => {
    if (!defaultValue) {
      setInputValue('');
    }
  }, [defaultValue]);

  return (
    <ControlledAutocomplete
      id={`columns.${index}.defaultValue`}
      name={`columns.${index}.defaultValue`}
      aria-label="Default Value"
      options={availableFunctions}
      hideEmptyHelperText
      autoHighlight
      autoSelect={(filteredOptions) =>
        filteredOptions?.length === 0 && inputValue.length > 0
      }
      freeSolo
      slotProps={{
        paper: { className: clsx(availableFunctions.length === 0 && 'hidden') },
        inputRoot: {
          'data-testid': `columns.${index}.defaultValue`,
        },
      }}
      disabled={isIdentity}
      noOptionsText="Enter a custom default value"
      placeholder="NULL"
      error={Boolean(errors?.columns?.[index]?.defaultValue)}
      helperText={errors?.columns?.[index]?.defaultValue?.message}
      inputValue={isIdentity ? '' : inputValue}
      onInputChange={(_event, value) => setInputValue(value)}
      onBlur={(event) => {
        if (event.target instanceof HTMLInputElement && !event.target.value) {
          setValue(`columns.${index}.defaultValue`, null);
        }
      }}
      showCustomOption="always"
      customOptionLabel={(optionLabel) => `Use "${optionLabel}" as a literal`}
    />
  );
}

function Checkbox({
  name,
  index,
  ...props
}: FieldArrayInputProps & PropsWithoutRef<CheckboxProps>) {
  const primaryKeyIndices = useWatch({ name: 'primaryKeyIndices' });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });

  const isPrimary = primaryKeyIndices.includes(`${index}`);
  const isIdentity = identityColumnIndex === index;

  return (
    <ControlledCheckbox
      name={name}
      disabled={isIdentity || isPrimary}
      uncheckWhenDisabled
      {...props}
    />
  );
}

export interface ColumnEditorRowProps extends FieldArrayInputProps {
  /**
   * Function to be called when the user wants to remove a row.
   */
  remove: (index: number) => void;
}

const ColumnEditorRow = memo(({ index, remove }: ColumnEditorRowProps) => (
  <div role="row" className="flex w-full gap-2">
    <div role="cell" className="w-52 flex-none">
      <NameInput index={index} />
    </div>

    <div role="cell" className="w-52 flex-none">
      <TypeAutocomplete index={index} />
    </div>

    <div role="cell" className="w-52 flex-none">
      <DefaultValueAutocomplete index={index} />
    </div>

    <div role="cell" className="flex w-8 flex-none items-center justify-center">
      <ColumnComment index={index} />
    </div>

    <div
      role="cell"
      className="flex w-13 flex-none items-center justify-center"
    >
      <Checkbox
        name={`columns.${index}.isNullable`}
        aria-label="Nullable"
        index={index}
        data-testid={`columns.${index}.isNullable`}
      />
    </div>

    <div
      role="cell"
      className="flex w-13 flex-none items-center justify-center"
    >
      <Checkbox
        name={`columns.${index}.isUnique`}
        aria-label="Unique"
        index={index}
      />
    </div>

    <div role="cell" className="flex w-9 flex-none items-center justify-center">
      <RemoveButton
        index={index}
        onClick={() => {
          remove(index);
        }}
      />
    </div>
  </div>
));

ColumnEditorRow.displayName = 'NhostColumnEditorRow';

export default ColumnEditorRow;
