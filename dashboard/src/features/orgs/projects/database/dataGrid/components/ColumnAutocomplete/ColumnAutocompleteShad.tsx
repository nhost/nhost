import type { InputProps } from '@/components/ui/v2/Input';
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
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import { cn } from '@/lib/utils';
import { Check, ChevronsUpDown } from 'lucide-react';

import type { ForwardedRef, PropsWithoutRef } from 'react';
import { forwardRef, useEffect, useState } from 'react';
import type { UseAsyncValueOptions } from './useAsyncValue';
import useAsyncValue from './useAsyncValue';
import type { UseColumnGroupsOptions } from './useColumnGroups';
import useColumnGroups from './useColumnGroups';

export interface ColumnAutocompleteProps
  extends Omit<PropsWithoutRef<InputProps>, 'onChange'> {
  /**
   * Schema where the `table` is located.
   */
  schema: string;
  /**
   * Table to get the columns from.
   */
  table: string;
  /**
   * Function to be called when the value changes.
   */
  onChange?: (value: {
    value: string;
    columnMetadata?: Record<string, any>;
    disableReset?: boolean;
  }) => void;
  /**
   * Function to be called when the input is asynchronously initialized.
   */
  onInitialized?: UseAsyncValueOptions['onInitialized'];
  /**
   * Class name to be applied to the root element.
   */
  rootClassName?: string;
  /**
   * Determines if the autocomplete should allow relationships.
   */
  disableRelationships?: UseColumnGroupsOptions['disableRelationships'];
}

function ColumnAutocompleteShad(
  {
    rootClassName,
    schema: defaultSchema,
    table: defaultTable,
    value: externalValue,
    disableRelationships,
    onChange,
    onInitialized,
    ...props
  }: ColumnAutocompleteProps,
  ref: ForwardedRef<HTMLInputElement>,
) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const [search, setSearch] = useState('');
  const [pages, setPages] = useState([]);
  const activePage = pages[pages.length - 1];

  const [activeRelationship, setActiveRelationship] = useState<{
    schema: string;
    table: string;
    name: string;
  }>();
  const selectedSchema = activeRelationship?.schema || defaultSchema;
  const selectedTable = activeRelationship?.table || defaultTable;

  const {
    data: tableData,
    status: tableStatus,
    error: tableError,
    isFetching: isTableFetching,
  } = useTableQuery([`default.${selectedSchema}.${selectedTable}`], {
    schema: selectedSchema,
    table: selectedTable,
    preventRowFetching: true,
    queryOptions: { refetchOnWindowFocus: false },
  });

  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
    isFetching: isMetadataFetching,
  } = useMetadataQuery([`default.metadata`], {
    queryOptions: { refetchOnWindowFocus: false },
  });

  const {
    initialized,
    inputValue,
    setInputValue,
    selectedColumn,
    setSelectedColumn,
    selectedRelationships,
    setSelectedRelationships,
    relationshipDotNotation,
    activeRelationship: asyncActiveRelationship,
  } = useAsyncValue({
    selectedSchema,
    selectedTable,
    initialValue: externalValue as string,
    isTableLoading: tableStatus === 'loading' || isTableFetching,
    isMetadataLoading: metadataStatus === 'loading' || isMetadataFetching,
    tableData,
    metadata,
    onInitialized,
  });

  console.log(activeRelationship);

  useEffect(() => {
    setActiveRelationship(asyncActiveRelationship);
  }, [asyncActiveRelationship]);

  const options = useColumnGroups({
    selectedSchema,
    selectedTable,
    tableData,
    metadata,
    disableRelationships,
  });

  const handleChange = (newValue: string) => {
    const selectedOption = options.find((option) => option.value === newValue);

    if (!selectedOption) {
      return;
    }

    setSelectedColumn(selectedOption);
    setOpen(false);
    setValue(newValue === value ? '' : newValue);

    onChange?.({
      value:
        selectedRelationships.length > 0
          ? [relationshipDotNotation, newValue].join('.')
          : newValue,
      columnMetadata: selectedOption.metadata,
    });
  };

  const handleRelationshipChange = (newValue: string) => {
    const selectedOption = options.find((option) => option.value === newValue);

    if (!selectedOption) {
      return;
    }

    setPages((p) => [...p, newValue]);
    setSelectedColumn(null);
    setSelectedRelationships((currentRelationships) => [
      ...currentRelationships,
      selectedOption.metadata?.target,
    ]);
  };

  console.log('options', options);
  const columns = options.filter((option) => option.group === 'columns');
  const relationships = options.filter(
    (option) => option.group === 'relationships',
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[200px] justify-between"
        >
          {value
            ? options.find((option) => option.value === value)?.label
            : 'Select a column'}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Backspace' && !search)) {
              e.preventDefault();
              setPages((p) => p.slice(0, -1));
              setSelectedColumn(null);
              setSelectedRelationships((activeRelationships) =>
                activeRelationships.slice(0, -1),
              );
            }
          }}
        >
          <div>
            {pages.map((p) => (
              <div key={p}>{p}</div>
            ))}
          </div>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            autoFocus
            placeholder="Select a column..."
          />
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            mytable
          </div>
          <CommandList>
            {!activePage && (
              <>
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup heading="columns">
                  {columns.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={handleChange}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === option.value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="flex gap-3">
                        {option.label}
                        <code className="relative rounded bg-primary px-[0.2rem] font-mono">
                          {option.metadata?.udt_name || option.value}
                        </code>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandGroup heading="relationships">
                  {relationships.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={handleRelationshipChange}
                    >
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {activePage === 'address' && (
              <>
                <CommandEmpty>No options found.</CommandEmpty>
                <CommandGroup heading="columns">
                  {columns.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={handleChange}
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === option.value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="flex gap-3">
                        {option.label}
                        <code className="relative rounded bg-primary px-[0.2rem] font-mono">
                          {option.metadata?.udt_name || option.value}
                        </code>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default forwardRef(ColumnAutocompleteShad);
