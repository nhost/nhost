import { Button, type ButtonProps } from '@/components/ui/v3/button';
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
import { Check, ChevronLeft, ChevronsUpDown } from 'lucide-react';

import useRuleGroupEditor from '@/features/orgs/projects/database/dataGrid/components/RuleGroupEditor/useRuleGroupEditor';
import { CommandLoading } from 'cmdk';
import type { ForwardedRef } from 'react';
import { forwardRef, useEffect, useState } from 'react';
import type { UseAsyncValueOptions } from './useAsyncValue';
import useAsyncValue from './useAsyncValue';
import type { UseColumnGroupsOptions } from './useColumnGroups';
import useColumnGroups from './useColumnGroups';

export interface ColumnAutocompleteProps extends Omit<ButtonProps, 'onChange'> {
  value?: string;
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
   * Determines if the autocomplete should allow relationships.
   */
  disableRelationships?: UseColumnGroupsOptions['disableRelationships'];
}

function ColumnAutocomplete(
  {
    schema: defaultSchema,
    table: defaultTable,
    value: externalValue,
    disableRelationships,
    onChange,
    onInitialized,
  }: ColumnAutocompleteProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');

  const { disabled } = useRuleGroupEditor();

  const [search, setSearch] = useState('');

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
    isFetching: isMetadataFetching,
  } = useMetadataQuery([`default.metadata`], {
    queryOptions: { refetchOnWindowFocus: false },
  });

  const {
    initialized,
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

  const [pages, setPages] = useState<string[]>([]);

  useEffect(() => {
    setPages(
      relationshipDotNotation ? [relationshipDotNotation?.split('.')[0]] : [],
    );
  }, [relationshipDotNotation]);

  const activePage = pages[pages.length - 1];

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

    const valueObj = {
      value:
        selectedRelationships.length > 0
          ? [relationshipDotNotation, newValue].join('.')
          : newValue,
      columnMetadata: selectedOption.metadata,
    };

    onChange?.(valueObj);
  };

  const handleRelationshipChange = (newValue: string) => {
    const selectedOption = options.find((option) => option.value === newValue);

    if (!selectedOption) {
      return;
    }

    setPages((p) => [...p, newValue]);
    setSelectedColumn(null);
    setSearch('');
    setSelectedRelationships((currentRelationships) => [
      ...currentRelationships,
      selectedOption.metadata?.target,
    ]);
  };

  const columns = options.filter((option) => option.group === 'columns');
  const relationships = options.filter(
    (option) => option.group === 'relationships',
  );

  const handleBackRelationship = () => {
    setPages((p) => p.slice(0, -1));
    setSelectedColumn(null);
    setSelectedRelationships((activeRelationships) =>
      activeRelationships.slice(0, -1),
    );
    setSearch('');
  };

  const buttonPrefix = relationshipDotNotation
    ? `${selectedTable}.${relationshipDotNotation}`
    : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={ref}
          disabled={disabled}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between"
        >
          {buttonPrefix ? (
            <div className="flex flex-shrink-0 gap-0 truncate">
              <span className="flex-shrink-0 truncate text-sm text-muted-foreground lg:max-w-[200px]">
                {buttonPrefix}.
              </span>
              {selectedColumn?.label}
            </div>
          ) : (
            selectedColumn?.label || 'Select a column'
          )}
          <ChevronsUpDown className="ml-2 h-5 w-5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="start"
        className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0"
      >
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
          <CommandInput
            value={search}
            onValueChange={setSearch}
            autoFocus
            placeholder=""
            prefix={
              relationshipDotNotation
                ? `
              ${selectedTable}.${relationshipDotNotation}.`
                : ``
            }
          />
          {pages?.length > 0 ? (
            <div className="flex flex-row items-center gap-2 px-2 py-1.5">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={handleBackRelationship}
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="py-1.5 text-sm text-muted-foreground">
                {defaultTable}.{pages.join('.')}
              </span>
            </div>
          ) : null}
          <CommandList>
            {!activePage && (
              <>
                <CommandEmpty>No options found.</CommandEmpty>
                {tableStatus === 'loading' ||
                  metadataStatus === 'loading' ||
                  (!initialized && <CommandLoading>Loading...</CommandLoading>)}
                <CommandGroup heading="columns">
                  {columns.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={handleChange}
                      className="overflow-x-hidden"
                    >
                      <Check
                        className={cn(
                          'mr-2 h-4 w-4',
                          value === option.value ? 'opacity-100' : 'opacity-0',
                        )}
                      />
                      <div className="flex gap-3">
                        <span className="line-clamp-2 break-all">
                          {option.label}
                        </span>
                        <div className="flex items-center">
                          <code className="relative rounded bg-primary px-[0.2rem] font-mono text-white">
                            {option.metadata?.udt_name || option.value}
                          </code>
                        </div>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
                {relationships.length > 0 && !disableRelationships && (
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
                )}
              </>
            )}
            {activePage && (
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
                        <span className="line-clamp-2 break-all">
                          {option.label}
                        </span>
                        <div className="flex items-center">
                          <code className="relative rounded bg-primary px-[0.2rem] font-mono text-white">
                            {option.metadata?.udt_name || option.value}
                          </code>
                        </div>
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

export default forwardRef(ColumnAutocomplete);
