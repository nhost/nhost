import { Check, ChevronsUpDown } from 'lucide-react';

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  ColumnAutocomplete,
  type ColumnAutocompleteProps,
} from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getAllPermissionVariables } from '@/features/projects/permissions/settings/utils/getAllPermissionVariables';
import { cn } from '@/lib/utils';
import { useGetRolesPermissionsQuery } from '@/utils/__generated__/graphql';
import { CommandLoading } from 'cmdk';
import { useState } from 'react';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import useRuleGroupEditor from './useRuleGroupEditor';

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
      onChange={({ value }) => {
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
}

export default function RuleValueInput({
  name,
  selectedTablePath,
  className,
}: RuleValueInputProps) {
  const { schema, table, disabled } = useRuleGroupEditor();
  const { project } = useProject();
  const { setValue, control } = useFormContext();
  const inputName = `${name}.value`;
  const { field } = useController({
    name: inputName,
    control,
  });

  const [open, setOpen] = useState(false);
  const comboboxValue = useWatch({ name: inputName });
  const operator: HasuraOperator = useWatch({ name: `${name}.operator` });

  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, loading } = useGetRolesPermissionsQuery({
    variables: { appId: project?.id },
    skip: !project?.id,
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (operator === '_is_null') {
    const defaultValue = !Array.isArray(comboboxValue) ? comboboxValue : null;
    return (
      <Select
        disabled={disabled}
        name={inputName}
        onValueChange={(newValue: string) => {
          setValue(inputName, newValue, { shouldDirty: true });
        }}
        defaultValue={defaultValue}
      >
        <SelectTrigger className="border hover:bg-accent hover:text-accent-foreground focus:ring-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <SelectValue placeholder="Is null?" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="true">
            <span className="font-medium">true</span>
          </SelectItem>
          <SelectItem value="false">
            <span className="font-medium">false</span>
          </SelectItem>
        </SelectContent>
      </Select>
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
    const defaultValue = Array.isArray(field.value) ? field.value : [];

    return (
      <FancyMultiSelect
        className={className}
        options={availableHasuraPermissionVariables}
        creatable
        defaultValue={defaultValue.map((v) => ({ value: v, label: v }))}
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
      />
    );
  }

  const selectedVariable = availableHasuraPermissionVariables.find(
    (variable) => variable.value === comboboxValue,
  );
  const comboboxLabel =
    selectedVariable?.label || comboboxValue || 'Select variable...';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between"
        >
          <span className="truncate">{comboboxLabel}</span>
          <ChevronsUpDown className="h-5 min-h-5 w-5 min-w-5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0"
      >
        <Command>
          <CommandInput placeholder="Choose variable..." />
          <CommandList>
            <CommandEmpty>No variable found.</CommandEmpty>
            {loading && <CommandLoading>Loading...</CommandLoading>}
            <CommandGroup>
              {availableHasuraPermissionVariables.map((variable) => (
                <CommandItem
                  key={variable.value}
                  value={variable.value}
                  onSelect={(currentValue) => {
                    setValue(inputName, currentValue, { shouldDirty: true });
                    setOpen(false);
                  }}
                >
                  {variable.label}
                  <Check
                    className={cn(
                      'ml-auto',
                      comboboxValue === variable.value
                        ? 'opacity-100'
                        : 'opacity-0',
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandCreateItem
              onCreate={(currentValue) => {
                setValue(inputName, currentValue, { shouldDirty: true });
                setOpen(false);
              }}
            />
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
