import { useFormContext, useWatch } from 'react-hook-form';
import {
  FormFreeCombobox,
  type FormFreeComboboxOption,
} from '@/components/form/FormFreeCombobox';
import { InlineCode } from '@/components/ui/v3/inline-code';
import {
  identityTypes,
  postgresTypeGroups,
} from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import type { FieldArrayInputProps } from './ColumnEditorRow';

const typeOptions: FormFreeComboboxOption[] = postgresTypeGroups.map(
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

export function TypeAutocomplete({ index }: FieldArrayInputProps) {
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
    <FormFreeCombobox
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

export default TypeAutocomplete;
