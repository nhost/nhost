import { ControlledSelect } from '@/components/form/ControlledSelect';

import { Check, ChevronsUpDown } from 'lucide-react';

import { ReadOnlyToggle } from '@/components/presentational/ReadOnlyToggle';
import type { InputProps } from '@/components/ui/v2/Input';
import { inputClasses } from '@/components/ui/v2/Input';
import { Option } from '@/components/ui/v2/Option';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandCreateItem,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import { FancyMultiSelect } from '@/components/ui/v3/fancy-multi-select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import type { ColumnAutocompleteProps } from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete';
import { ColumnAutocomplete } from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getAllPermissionVariables } from '@/features/projects/permissions/settings/utils/getAllPermissionVariables';
import { cn } from '@/lib/utils';
import { useGetRolesPermissionsQuery } from '@/utils/__generated__/graphql';
import { useState } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import useRuleGroupEditor from './useRuleGroupEditor';

const frameworks = [
  {
    value: 'next.js',
    label: 'Next.js',
  },
  {
    value: 'sveltekit',
    label: 'SvelteKit',
  },
  {
    value: 'nuxt.js',
    label: 'Nuxt.js',
  },
  {
    value: 'remix',
    label: 'Remix',
  },
  {
    value: 'astro',
    label: 'Astro',
  },
];

function ColumnSelectorInput({
  name,
  selectedTablePath,
  schema,
  table,
  disabled,
  ...props
}: ColumnAutocompleteProps & { selectedTablePath: string }) {
  const { setValue, control } = useFormContext();
  const { field } = useController({
    name,
    control,
  });

  return (
    <ColumnAutocomplete
      {...props}
      {...field}
      disabled={disabled}
      value={
        // this array can either be ['$', 'columnName'] or ['columnName']
        Array.isArray(field.value) ? field.value.slice(-1)[0] : field.value
      }
      schema={schema}
      table={table}
      disableRelationships
      slotProps={{
        input: {
          className: 'lg:!rounded-none !z-10',
          sx: !disabled
            ? {
                backgroundColor: (theme) =>
                  theme.palette.mode === 'dark'
                    ? theme.palette.grey[300]
                    : theme.palette.common.white,
                [`& .${inputClasses.input}`]: {
                  backgroundColor: 'transparent',
                },
              }
            : undefined,
        },
      }}
      onChange={(_event, { value }) => {
        if (selectedTablePath === `${schema}.${table}`) {
          setValue(name, [value], { shouldDirty: true });
          return;
        }

        // For more information, see https://github.com/hasura/graphql-engine/issues/3459#issuecomment-1085666541
        setValue(name, ['$', value], { shouldDirty: true });
      }}
    />
  );
}

export interface RuleValueInputProps {
  /**
   * Name of the parent group editor.
   */
  name: string;
  /**
   * Class name to apply to the input wrapper.
   */
  className?: string;
  /**
   * Path of the table selected through the column input.
   */
  selectedTablePath?: string;
  /**
   * Whether the input should be marked as invalid.
   */
  error?: InputProps['error'];
  /**
   * Helper text to display below the input.
   */
  helperText?: InputProps['helperText'];
}

export default function RuleValueInput({
  name,
  selectedTablePath,
  error,
  className,
  helperText,
}: RuleValueInputProps) {
  const { schema, table, disabled } = useRuleGroupEditor();
  const { project } = useProject();
  const { setValue } = useFormContext();

  const [open, setOpen] = useState(false);
  const [comboboxValue, setComboboxValue] = useState('');
  const inputName = `${name}.value`;
  console.log('error', helperText);
  const operator: HasuraOperator = useWatch({ name: `${name}.operator` });
  const sharedInputSx: InputProps['sx'] = !disabled
    ? {
        backgroundColor: (theme) =>
          theme.palette.mode === 'dark'
            ? theme.palette.grey[300]
            : theme.palette.common.white,
        [`& .${inputClasses.input}`]: {
          backgroundColor: 'transparent',
        },
      }
    : undefined;

  const {
    data,
    loading,
    error: customClaimsError,
  } = useGetRolesPermissionsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
  });

  if (operator === '_is_null') {
    return (
      <ControlledSelect
        disabled={disabled}
        name={inputName}
        fullWidth
        slotProps={{
          root: {
            className: 'lg:!rounded-none h-10',
            sx: !disabled
              ? {
                  backgroundColor: (theme) =>
                    theme.palette.mode === 'dark'
                      ? `${theme.palette.grey[300]} !important`
                      : `${theme.palette.common.white} !important`,
                }
              : null,
          },
          popper: { disablePortal: false, className: 'z-[10000]' },
        }}
        error={error}
        helperText={helperText}
      >
        <Option value="true">
          <ReadOnlyToggle
            checked
            slotProps={{ label: { className: '!text-sm' } }}
          />
        </Option>

        <Option value="false">
          <ReadOnlyToggle
            checked={false}
            slotProps={{ label: { className: '!text-sm' } }}
          />
        </Option>
      </ControlledSelect>
    );
  }
  const availableHasuraPermissionVariables = getAllPermissionVariables(
    data?.config?.auth?.session?.accessToken?.customClaims,
  ).map(({ key }) => ({
    value: `X-Hasura-${key}`,
    label: `X-Hasura-${key}`,
    group: 'Frequently used',
  }));

  if (operator === '_in' || operator === '_nin') {
    return (
      <FancyMultiSelect
        className={className}
        options={availableHasuraPermissionVariables}
        creatable
        onChange={(value) => {
          setValue(
            inputName,
            value.map((v) => v.value),
            { shouldDirty: true },
          );
        }}
      />
    );
  }

  if (['_ceq', '_cne', '_cgt', '_clt', '_cgte', '_clte'].includes(operator)) {
    return (
      <ColumnSelectorInput
        disabled={disabled}
        selectedTablePath={selectedTablePath}
        schema={schema}
        table={table}
        name={inputName}
        error={error}
        helperText={helperText}
      />
    );
  }

  const selectedFramework = frameworks.find(
    (framework) => framework.value === comboboxValue,
  );
  const comboboxLabel =
    selectedFramework?.label || comboboxValue || 'Select framework...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {comboboxLabel}
          <ChevronsUpDown className="opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command
          filter={(item, query) => {
            console.log('item', item);
            if (item === 'create') {
              console.log('CREATE*++');
              if (
                frameworks.some(
                  (framework) =>
                    framework.value === query || framework.label === query,
                )
              ) {
                console.log('RETURNING 0 for query', query);
                return 0;
              }
              return 1;
            }
            if (item.toLowerCase().includes(query.trim().toLowerCase())) {
              return 1;
            }
            return 0;
          }}
        >
          <CommandInput placeholder="Search framework..." />
          <CommandList>
            <CommandEmpty>No framework found.</CommandEmpty>
            <CommandGroup>
              {frameworks.map((framework) => (
                <CommandItem
                  key={framework.value}
                  value={framework.value}
                  onSelect={(currentValue) => {
                    setComboboxValue(
                      currentValue === comboboxValue ? '' : currentValue,
                    );
                    setOpen(false);
                  }}
                >
                  {framework.label}
                  <Check
                    className={cn(
                      'ml-auto',
                      comboboxValue === framework.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandCreateItem
              onCreate={(currentValue) => {
                setComboboxValue(currentValue);
                setOpen(false);
              }}
            />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
    // <ControlledAutocomplete
    //   disabled={disabled}
    //   freeSolo
    //   isOptionEqualToValue={(
    //     option,
    //     value: string | number | AutocompleteOption<string>,
    //   ) => {
    //     if (typeof value !== 'object') {
    //       return option.value.toLowerCase() === value?.toString().toLowerCase();
    //     }

    //     return option.value.toLowerCase() === value.value.toLowerCase();
    //   }}
    //   name={inputName}
    //   groupBy={(option) => option.group}
    //   slotProps={{
    //     input: {
    //       className: 'lg:!rounded-none',
    //       sx: sharedInputSx,
    //     },
    //     formControl: { className: '!bg-transparent' },
    //     paper: { className: 'empty:border-transparent' },
    //   }}
    //   fullWidth
    //   loading={loading}
    //   loadingText={<ActivityIndicator label="Loading..." />}
    //   error={Boolean(customClaimsError) || error}
    //   helperText={customClaimsError?.message || helperText}
    //   options={availableHasuraPermissionVariables}
    //   onChange={(_event, _value, reason, details) => {
    //     if (
    //       reason !== 'selectOption' &&
    //       details.option.value !== 'X-Hasura-User-Id'
    //     ) {
    //       return;
    //     }

    //     setValue(inputName, details.option.value, { shouldDirty: true });
    //   }}
    // />
  );
}
