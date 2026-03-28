import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import { FormField, FormMessage } from '@/components/ui/v3/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import useColumnGroups from '@/features/orgs/projects/database/dataGrid/components/ColumnAutocomplete/useColumnGroups';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import { cn, isNotEmptyValue } from '@/lib/utils';
import useCustomCheckEditor from './useCustomCheckEditor';

interface RelationshipComboBoxProps {
  name: string;
  relationship: string;
  onChange: (value: { name: string; schema: string; table: string }) => void;
  disabled?: boolean;
}

export default function RelationshipComboBox({
  name,
  relationship,
  onChange,
  disabled,
}: RelationshipComboBoxProps) {
  const [open, setOpen] = useState(false);
  const { control } = useFormContext();
  const { schema, table } = useCustomCheckEditor();

  const { data: tableData } = useTableSchemaQuery(
    [`default.${schema}.${table}`],
    {
      schema,
      table,
      queryOptions: { refetchOnWindowFocus: false },
    },
  );

  const { data: metadata } = useMetadataQuery([`default.metadata`], {
    queryOptions: { refetchOnWindowFocus: false },
  });

  const options = useColumnGroups({
    selectedSchema: schema,
    selectedTable: table,
    tableData,
    metadata,
  });

  const relationships = options.filter(
    (option) => option.group === 'relationships',
  );

  const handleSelect = (value: string) => {
    const found = relationships.find((r) => r.value === value);
    if (found) {
      const target = found.metadata?.target as {
        schema: string;
        table: string;
        name: string;
      };
      onChange({
        name: found.value,
        schema: target?.schema || 'public',
        table: target?.table || '',
      });
    }
    setOpen(false);
  };

  return (
    <FormField
      name={`${name}.relationship`}
      control={control}
      render={({ fieldState }) => {
        const hasError = isNotEmptyValue(fieldState.error?.message);
        return (
          <div className="flex flex-col gap-2">
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button
                  disabled={disabled}
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className={cn('justify-between', {
                    'border-destructive text-destructive': hasError,
                  })}
                >
                  {relationship || 'Select relationship...'}
                  <ChevronsUpDown className="h-5 w-5 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-80 p-0">
                <Command>
                  <CommandInput placeholder="Search relationship..." />
                  <CommandList>
                    <CommandEmpty>No relationships found.</CommandEmpty>
                    <CommandGroup>
                      {relationships.map((r) => (
                        <CommandItem
                          key={r.value}
                          value={r.value}
                          onSelect={handleSelect}
                        >
                          <Check
                            className={cn(
                              'mr-2',
                              r.value === relationship
                                ? 'opacity-100'
                                : 'opacity-0',
                            )}
                          />
                          {r.label}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            <FormMessage />
          </div>
        );
      }}
    />
  );
}
