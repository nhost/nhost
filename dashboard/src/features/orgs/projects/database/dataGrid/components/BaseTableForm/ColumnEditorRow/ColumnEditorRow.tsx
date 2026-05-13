import { Sigma } from 'lucide-react';
import { memo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  FormAutocomplete,
  type FormAutocompleteOption,
} from '@/components/form/FormAutocomplete';
import { FormCheckbox } from '@/components/form/FormCheckbox';
import { FormInput } from '@/components/form/FormInput';
import { InlineCode } from '@/components/ui/v3/inline-code';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  identityTypes,
  postgresTypeGroups,
} from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import ColumnComment from './ColumnComment';
import DefaultValueAutocomplete from './DefaultValueAutocomplete';
import { RemoveButton } from './RemoveButton';

export interface FieldArrayInputProps {
  /**
   * Index of the field in the field array.
   */
  index: number;
}

function GeneratedBadge({
  generationExpression,
}: {
  generationExpression: string | null | undefined;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="mr-1 flex cursor-help items-center text-muted-foreground">
          <Sigma width={14} height={14} aria-label="Generated column" />
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={8}>
        <span className="font-semibold">Generated column</span> — value is
        computed from {generationExpression}. Type and constraints are fixed,
        but you can rename, edit the comment, or drop the column.
      </TooltipContent>
    </Tooltip>
  );
}

function NameInput({ index }: FieldArrayInputProps) {
  const { control, clearErrors, setValue, getValues } = useFormContext();
  const originalColumnName = getValues(`columns.${index}.name`);
  const foreignKeyRelations = getValues(`foreignKeyRelations`);
  const originalForeignKeyRelationIndex = foreignKeyRelations.findIndex(
    (relation: ForeignKeyRelation) =>
      relation.columnName === originalColumnName,
  );

  const primaryKeyIndices: string[] = useWatch({ name: 'primaryKeyIndices' });
  const isGenerated = useWatch({ name: `columns.${index}.isGenerated` });
  const generationExpression = useWatch({
    name: `columns.${index}.generationExpression`,
  });

  return (
    <FormInput
      control={control}
      name={`columns.${index}.name`}
      aria-label="Name"
      placeholder="Enter name"
      autoComplete="off"
      className="border-border"
      data-testid={`columns.${index}.name`}
      addonEnd={
        isGenerated ? (
          <GeneratedBadge generationExpression={generationExpression} />
        ) : undefined
      }
      onChange={(event) => {
        if (originalForeignKeyRelationIndex > -1) {
          setValue(
            `foreignKeyRelations.${originalForeignKeyRelationIndex}.columnName`,
            event.target.value,
          );
        }
      }}
      onBlur={(event) => {
        clearErrors('columns');
        if (!event.target.value && primaryKeyIndices.includes(`${index}`)) {
          setValue(
            'primaryKeyIndices',
            primaryKeyIndices.filter((pk) => pk !== `${index}`),
          );
        }
      }}
    />
  );
}

const typeOptions: FormAutocompleteOption[] = postgresTypeGroups.map(
  ({ group, label, value }) => ({
    value,
    group,
    label,
    render: (
      <div className="grid grid-flow-col items-baseline justify-start justify-items-start gap-1.5">
        <span>{label}</span>
        <InlineCode>{value}</InlineCode>
      </div>
    ),
  }),
);

function TypeAutocomplete({ index }: FieldArrayInputProps) {
  const { control, setValue } = useFormContext();
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const isGenerated = useWatch({ name: `columns.${index}.isGenerated` });
  const type: string | null = useWatch({ name: `columns.${index}.type` });

  if (isGenerated) {
    return (
      <div
        className="flex h-10 w-full cursor-not-allowed items-center rounded-md border bg-background px-4 py-2 text-sm opacity-50"
        data-testid={`columns.${index}.type`}
      >
        <span className="truncate">{type ?? ''}</span>
      </div>
    );
  }

  return (
    <FormAutocomplete
      control={control}
      name={`columns.${index}.type`}
      placeholder="Select type"
      aria-label="Type"
      searchPlaceholder="Search types..."
      options={typeOptions}
      filter={(value, search, keywords) => {
        const haystack = [value, ...(keywords ?? [])].join(' ').toLowerCase();
        return haystack.includes(search.toLowerCase()) ? 1 : 0;
      }}
      allowCustomValue
      customValueLabel={(input) => `Use type: "${input}"`}
      data-testid={`columns.${index}.type`}
      popoverContentClassName="w-80"
      onChange={(value) => {
        setValue(`columns.${index}.defaultValue`, null);
        if (
          value !== null &&
          !(identityTypes as readonly string[]).includes(value) &&
          identityColumnIndex !== null &&
          identityColumnIndex !== undefined &&
          identityColumnIndex === index
        ) {
          setValue('identityColumnIndex', null);
        }
      }}
    />
  );
}

interface CheckboxProps extends FieldArrayInputProps {
  name: string;
  'aria-label'?: string;
  'data-testid'?: string;
}

function Checkbox({ name, index, ...props }: CheckboxProps) {
  const { control } = useFormContext();
  const primaryKeyIndices = useWatch({ name: 'primaryKeyIndices' });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const isGenerated = useWatch({ name: `columns.${index}.isGenerated` });

  const isPrimary = primaryKeyIndices.includes(`${index}`);
  const isIdentity = identityColumnIndex === index;

  return (
    <FormCheckbox
      control={control}
      name={name}
      disabled={isGenerated || isIdentity || isPrimary}
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
  <div className="flex w-full gap-2">
    <div className="w-52 flex-none">
      <NameInput index={index} />
    </div>

    <div className="w-52 flex-none">
      <TypeAutocomplete index={index} />
    </div>

    <div className="w-52 flex-none">
      <DefaultValueAutocomplete index={index} />
    </div>

    <div className="flex w-8 flex-none items-center justify-center">
      <ColumnComment index={index} />
    </div>

    <div className="flex w-13 flex-none items-center justify-center">
      <Checkbox
        name={`columns.${index}.isNullable`}
        aria-label="Nullable"
        index={index}
        data-testid={`columns.${index}.isNullable`}
      />
    </div>

    <div className="flex w-13 flex-none items-center justify-center">
      <Checkbox
        name={`columns.${index}.isUnique`}
        aria-label="Unique"
        index={index}
        data-testid={`columns.${index}.isUnique`}
      />
    </div>

    <div className="flex w-9 flex-none items-center justify-center">
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
