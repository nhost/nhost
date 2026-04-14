import { Check, ChevronsUpDown } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import { cn } from '@/lib/utils';

interface TableComboBoxProps {
  schema: string;
  table: string;
  onChange: (value: { schema: string; table: string }) => void;
  disabled?: boolean;
}

export default function TableComboBox({
  schema,
  table,
  onChange,
  disabled,
}: TableComboBoxProps) {
  const [open, setOpen] = useState(false);

  const { data: metadata } = useMetadataQuery(['default.metadata']);

  const tables = (metadata?.tables ?? []).map((t) => ({
    schema: t.table.schema,
    table: t.table.name,
    label: `${t.table.schema}.${t.table.name}`,
    value: `${t.table.schema}.${t.table.name}`,
  }));

  const selectedLabel = schema && table ? `${schema}.${table}` : null;

  const handleSelect = (value: string) => {
    const found = tables.find((t) => t.value === value);
    if (found) {
      onChange({ schema: found.schema, table: found.table });
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          disabled={disabled}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between"
        >
          {selectedLabel ?? 'Select table...'}
          <ChevronsUpDown className="h-5 w-5 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search table..." />
          <CommandList>
            <CommandEmpty>No table found.</CommandEmpty>
            <CommandGroup>
              {tables.map((t) => (
                <CommandItem
                  key={t.value}
                  value={t.value}
                  onSelect={handleSelect}
                >
                  <Check
                    className={cn(
                      'mr-2',
                      t.value === selectedLabel ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {t.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
