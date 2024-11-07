import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { ControlledCheckbox } from '@/components/form/ControlledCheckbox';
import { InlineCode } from '@/components/presentational/InlineCode';
import type { ButtonProps } from '@/components/ui/v2/Button';
import type { CheckboxProps } from '@/components/ui/v2/Checkbox';
import { IconButton } from '@/components/ui/v2/IconButton';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
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
    name: [`columns`, `columns.${index}.name`],
  });

  const primaryKeyIndex: number = useWatch({ name: 'primaryKeyIndex' });

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

          if (!event.target.value && primaryKeyIndex === index) {
            setValue('primaryKeyIndex', null);

            return;
          }

          if (
            event.target.value &&
            (primaryKeyIndex === null || typeof primaryKeyIndex === 'undefined')
          ) {
            setValue('primaryKeyIndex', index);
          }
        },
      })}
      autoComplete="off"
      aria-label="Name"
      placeholder="Enter name"
      hideEmptyHelperText
      error={Boolean(errors?.columns?.[index]?.name)}
      helperText={errors?.columns?.[index]?.name?.message}
    />
  );
}

function TypeAutocomplete({ index }: FieldArrayInputProps) {
  const { setValue } = useFormContext();
  const { errors } = useFormState({ name: `columns.${index}.type` });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });

  return (
    <ControlledAutocomplete
      id={`columns.${index}.type`}
      name={`columns.${index}.type`}
      aria-label="Type"
      options={postgresTypeGroups}
      groupBy={(option) => option.group}
      placeholder="Select type"
      hideEmptyHelperText
      autoHighlight
      noOptionsText="No types found"
      error={Boolean(errors?.columns?.[index]?.type)}
      helperText={(errors?.columns?.[index]?.type as FieldError)?.message}
      renderOption={(props, { label, value }) => (
        <OptionBase {...props}>
          <div className="grid grid-flow-col items-baseline justify-start justify-items-start gap-1.5">
            <span>{label}</span>

            <InlineCode>{value}</InlineCode>
          </div>
        </OptionBase>
      )}
      onChange={(_event, value) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          return;
        }

        setValue(`columns.${index}.defaultValue`, null);

        // We need to reset identityColumnIndex if the column
        // that's being edited is the identity column, but its
        // new type is not suitable for identity columns.
        if (
          !identityTypes.includes(value.value as ColumnType) &&
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
        filteredOptions.length === 0 && inputValue.length > 0
      }
      freeSolo
      slotProps={{
        paper: { className: clsx(availableFunctions.length === 0 && 'hidden') },
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
  const primaryKeyIndex = useWatch({ name: 'primaryKeyIndex' });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const isPrimary = primaryKeyIndex === index;
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

function RemoveButton({ index, onClick }: FieldArrayInputProps & ButtonProps) {
  const { setValue } = useFormContext();
  const foreignKeyRelations: ForeignKeyRelation[] = useWatch({
    name: 'foreignKeyRelations',
  });
  const columns = useWatch({ name: 'columns' });
  const primaryKeyIndex = useWatch({ name: 'primaryKeyIndex' });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });

  return (
    <IconButton
      variant="outlined"
      color="secondary"
      size="small"
      className="h-9 w-9"
      disabled={columns?.length === 1}
      aria-label="Remove column"
      onClick={(event) => {
        if (onClick) {
          onClick(event);
        }

        if (
          foreignKeyRelations.find(
            (foreignKeyRelation) =>
              foreignKeyRelation.columnName === columns[index].name,
          )
        ) {
          setValue(
            'foreignKeyRelations',
            foreignKeyRelations.filter(
              (foreignKeyRelation) =>
                foreignKeyRelation.columnName !== columns[index].name,
            ),
          );
        }

        if (primaryKeyIndex === index) {
          setValue('primaryKeyIndex', null);
        }

        if (identityColumnIndex === index) {
          setValue('identityColumnIndex', null);
        }
      }}
    >
      <XIcon className="h-4 w-4" />
    </IconButton>
  );
}

export interface ColumnEditorRowProps extends FieldArrayInputProps {
  /**
   * Function to be called when the user wants to remove a row.
   */
  remove?: (index: number) => void;
}

const ColumnEditorRow = memo(({ index, remove }: ColumnEditorRowProps) => (
  <div role="row" className="grid w-full grid-cols-12 gap-1">
    <div role="cell" className="col-span-3">
      <NameInput index={index} />
    </div>

    <div role="cell" className="col-span-3">
      <TypeAutocomplete index={index} />
    </div>

    <div role="cell" className="col-span-3">
      <DefaultValueAutocomplete index={index} />
    </div>

    <div role="cell" className="col-span-1 flex justify-center py-3">
      <Checkbox
        name={`columns.${index}.isNullable`}
        aria-label="Nullable"
        index={index}
      />
    </div>

    <div role="cell" className="col-span-1 flex justify-center py-3">
      <Checkbox
        name={`columns.${index}.isUnique`}
        aria-label="Unique"
        index={index}
      />
    </div>

    <div role="cell" className="col-span-1 flex justify-center py-0.5">
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
