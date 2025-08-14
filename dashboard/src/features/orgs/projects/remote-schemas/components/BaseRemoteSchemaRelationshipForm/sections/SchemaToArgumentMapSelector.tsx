import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { Button as ButtonV3 } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/v3/command';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
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
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import { cn } from '@/lib/utils';
import { isObjectType } from 'graphql';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';

export interface SchemaToArgumentMapSelectorProps {
  sourceSchema: string;
}

export default function SchemaToArgumentMapSelector({
  sourceSchema,
}: SchemaToArgumentMapSelectorProps) {
  const form = useFormContext<RemoteSchemaRelationshipFormValues>();

  // Watch form values to reactively get field arguments
  const selectedSourceType = form.watch('sourceType');
  const selectedTargetRemoteSchema = form.watch('targetRemoteSchema');
  const selectedTargetField = form.watch('targetField');

  // Introspect the source remote schema to get its types and fields
  const { data: sourceIntrospectionData } = useIntrospectRemoteSchemaQuery(
    sourceSchema,
    {
      queryOptions: {
        enabled: !!sourceSchema,
      },
    },
  );

  // Introspect the target remote schema to get field arguments
  const { data: targetIntrospectionData } = useIntrospectRemoteSchemaQuery(
    selectedTargetRemoteSchema,
    {
      queryOptions: {
        enabled: !!selectedTargetRemoteSchema,
      },
    },
  );

  // Extract fields from the selected source type
  const sourceFields =
    sourceIntrospectionData && selectedSourceType
      ? (() => {
          const graphqlSchema = convertIntrospectionToSchema(
            sourceIntrospectionData,
          );

          if (!graphqlSchema) {
            return [];
          }

          const type = graphqlSchema.getType(selectedSourceType);

          if (isObjectType(type)) {
            const fields = type.getFields();
            return Object.keys(fields).map((fieldName) => ({
              label: fieldName,
              value: fieldName,
              type: fields[fieldName].type.toString(), // For display purposes
            }));
          }

          return [];
        })()
      : [];

  // Extract arguments from the selected target field
  const targetArguments =
    targetIntrospectionData && selectedTargetField
      ? (() => {
          const graphqlSchema = convertIntrospectionToSchema(
            targetIntrospectionData,
          );

          if (!graphqlSchema) {
            return [];
          }

          const queryType = graphqlSchema.getQueryType();

          if (!queryType) {
            return [];
          }

          const fields = queryType.getFields();
          const targetFieldObject = fields[selectedTargetField];

          if (!targetFieldObject?.args) {
            return [];
          }

          // Extract the arguments from the field
          return targetFieldObject.args.map((arg) => ({
            label: arg.name,
            value: arg.name,
            type: arg.type.toString(),
            required: arg.type.toString().includes('!'), // NonNull types end with !
          }));
        })()
      : [];

  const { fields, append, remove } =
    useFieldArray<RemoteSchemaRelationshipFormValues>({
      name: 'mappings',
    });

  // Helper function to check if an argument is selected
  const isArgumentSelected = (argumentName: string) =>
    fields.some((field) => field.argument === argumentName);

  // Helper function to get the index of a mapping for a specific argument
  const getArgumentMappingIndex = (argumentName: string) =>
    fields.findIndex((field) => field.argument === argumentName);

  // Handle checkbox change
  const handleArgumentToggle = (argumentName: string, checked: boolean) => {
    if (checked) {
      // Add mapping for this argument
      append({
        argument: argumentName,
        type: 'sourceTypeField',
        value: '',
      });
    } else {
      // Remove mapping for this argument
      const index = getArgumentMappingIndex(argumentName);
      if (index !== -1) {
        remove(index);
      }
    }
  };

  if (!selectedTargetField) {
    return (
      <Box className="space-y-4 rounded border-1 p-4">
        <Text className="text-sm text-muted-foreground">
          Select a target field to configure argument mappings.
        </Text>
      </Box>
    );
  }

  return (
    <Box className="space-y-4 rounded border-1 p-4">
      <Box className="flex flex-col space-y-4">
        <Text className="text-lg font-semibold">
          Configure arguments for {selectedTargetField}
        </Text>

        {targetArguments.length === 0 ? (
          <Text className="text-sm text-muted-foreground">
            No selectable items available for this type
          </Text>
        ) : (
          <div className="space-y-3">
            {targetArguments.map((argument) => {
              const isSelected = isArgumentSelected(argument.value);
              const mappingIndex = getArgumentMappingIndex(argument.value);

              // Watch the type field for this specific mapping to make it reactive
              const currentType =
                mappingIndex !== -1
                  ? form.watch(`mappings.${mappingIndex}.type`)
                  : null;

              return (
                <div key={argument.value} className="space-y-2">
                  {/* Argument header with checkbox */}
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`arg-${argument.value}`}
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleArgumentToggle(argument.value, checked as boolean)
                      }
                    />
                    <label
                      htmlFor={`arg-${argument.value}`}
                      className="cursor-pointer text-sm font-medium"
                    >
                      {argument.label}
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({argument.type})
                      </span>
                      {argument.required && (
                        <span className="ml-1 text-xs text-red-500">*</span>
                      )}
                    </label>
                  </div>

                  {/* Configuration options when selected */}
                  {isSelected && mappingIndex !== -1 && (
                    <div className="ml-6 flex items-center space-x-0">
                      {/* Type Selection */}
                      <FormField
                        control={form.control}
                        name={`mappings.${mappingIndex}.type`}
                        render={({ field: typeField }) => (
                          <FormItem>
                            <FormLabel>Fill From</FormLabel>
                            <Select
                              onValueChange={typeField.onChange}
                              defaultValue={typeField.value}
                            >
                              <FormControl>
                                <SelectTrigger className="w-40 rounded-r-none border-r-0">
                                  <SelectValue placeholder="Type" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="sourceTypeField">
                                  Source Field
                                </SelectItem>
                                <SelectItem value="staticValue">
                                  Static Value
                                </SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Value Selection/Input */}
                      <FormField
                        control={form.control}
                        name={`mappings.${mappingIndex}.value`}
                        render={({ field: valueField }) => (
                          <FormItem className="flex-1">
                            {currentType === 'sourceTypeField' ? (
                              // Source field selector
                              <>
                                <FormLabel>From Source Type Field</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <ButtonV3
                                        variant="outline"
                                        role="combobox"
                                        className={cn(
                                          'w-full justify-between rounded-l-none',
                                          !valueField.value &&
                                            'text-muted-foreground',
                                        )}
                                      >
                                        {valueField.value
                                          ? sourceFields.find(
                                              (field) =>
                                                field.value ===
                                                valueField.value,
                                            )?.label
                                          : 'Select source field'}
                                        <ChevronsUpDown className="opacity-50" />
                                      </ButtonV3>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="max-h-[var(--radix-popover-content-available-height)] w-[var(--radix-popover-trigger-width)] p-0">
                                    <Command>
                                      <CommandInput
                                        placeholder="Search field..."
                                        className="h-9"
                                      />
                                      <CommandList>
                                        <CommandEmpty>
                                          No source fields found.
                                        </CommandEmpty>
                                        <CommandGroup>
                                          {sourceFields.map((field) => (
                                            <CommandItem
                                              value={field.value}
                                              key={field.value}
                                              onSelect={() => {
                                                valueField.onChange(
                                                  field.value,
                                                );
                                              }}
                                            >
                                              {field.label} ({field.type})
                                              <Check
                                                className={cn(
                                                  'ml-auto',
                                                  field.value ===
                                                    valueField.value
                                                    ? 'opacity-100'
                                                    : 'opacity-0',
                                                )}
                                              />
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </>
                            ) : (
                              // Static value input
                              <>
                                <FormLabel>Static Value</FormLabel>
                                <Input
                                  {...valueField}
                                  placeholder="Enter static value"
                                  className="rounded-l-none"
                                />
                              </>
                            )}
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Box>
    </Box>
  );
}
