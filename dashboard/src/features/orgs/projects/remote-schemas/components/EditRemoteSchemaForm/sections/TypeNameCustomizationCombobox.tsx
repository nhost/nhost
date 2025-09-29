import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
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
import { cn } from '@/lib/utils';
import type { GraphQLTypeForVisualization } from '@/utils/hasura-api/generated/schemas';
import { Check, ChevronsUpDown } from 'lucide-react';

interface TypeNameCustomizationComboboxProps {
  fromType: string;
  schemaTypes: GraphQLTypeForVisualization[];
  changeTypeKey: (fromType: string, toType: string) => void;
}

export default function TypeNameCustomizationCombobox({
  fromType,
  schemaTypes,
  changeTypeKey,
}: TypeNameCustomizationComboboxProps) {
  return (
    <Box>
      <Text className="font-medium">Type</Text>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              'mt-1 w-full justify-between overflow-hidden text-left',
              !fromType && 'text-muted-foreground',
            )}
          >
            <span className="truncate">{fromType || 'Select a type'}</span>
            <ChevronsUpDown className="ml-2 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
          <Command>
            <CommandInput placeholder="Search type..." className="h-9" />
            <CommandList>
              <CommandEmpty>No type found.</CommandEmpty>
              <CommandGroup>
                {schemaTypes.map((t) => (
                  <CommandItem
                    value={t.name!}
                    key={t.name!}
                    onSelect={() => changeTypeKey(fromType, t.name!)}
                    className="flex items-center"
                  >
                    <span className="min-w-0 flex-1 truncate">{t.name}</span>
                    <Check
                      className={cn(
                        'ml-2 shrink-0',
                        t.name === fromType ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </Box>
  );
}
