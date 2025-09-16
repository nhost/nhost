import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { Checkbox } from '@/components/ui/v3/checkbox';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import { isObjectType } from 'graphql';
import { useFieldArray, useFormContext } from 'react-hook-form';
import type { RemoteSchemaRelationshipFormValues } from './RemoteSchemaRelationshipForm';
import SchemaToArgumentMapSelectorValue from './SchemaToArgumentMapSelectorValue';

export interface SchemaToArgumentMapSelectorProps {
  sourceSchema: string;
  disabled?: boolean;
}

export default function SchemaToArgumentMapSelector({
  sourceSchema,
  disabled,
}: SchemaToArgumentMapSelectorProps) {
  const form = useFormContext<RemoteSchemaRelationshipFormValues>();

  const selectedSourceType = form.watch('sourceType');
  const selectedTargetRemoteSchema = form.watch('targetRemoteSchema');
  const selectedTargetField = form.watch('targetField');

  const { data: sourceIntrospectionData } = useIntrospectRemoteSchemaQuery(
    sourceSchema,
    {
      queryOptions: {
        enabled: !!sourceSchema,
      },
    },
  );

  const { data: targetIntrospectionData } = useIntrospectRemoteSchemaQuery(
    selectedTargetRemoteSchema,
    {
      queryOptions: {
        enabled: !!selectedTargetRemoteSchema,
      },
    },
  );

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
              type: fields[fieldName].type.toString(),
            }));
          }

          return [];
        })()
      : [];

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

          return targetFieldObject.args.map((arg) => ({
            label: arg.name,
            value: arg.name,
            type: arg.type.toString(),
            required: arg.type.toString().includes('!'),
          }));
        })()
      : [];

  const { fields, append, remove } =
    useFieldArray<RemoteSchemaRelationshipFormValues>({
      name: 'mappings',
    });

  const isArgumentSelected = (argumentName: string) =>
    fields.some((field) => field.argument === argumentName);

  const getArgumentMappingIndex = (argumentName: string) =>
    fields.findIndex((field) => field.argument === argumentName);

  const handleArgumentToggle = (argumentName: string, checked: boolean) => {
    if (checked) {
      append({
        argument: argumentName,
        type: 'sourceTypeField',
        value: '',
      });
    } else {
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

              const currentType =
                mappingIndex !== -1
                  ? form.watch(`mappings.${mappingIndex}.type`)
                  : null;

              return (
                <div key={argument.value} className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id={`arg-${argument.value}`}
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleArgumentToggle(argument.value, checked as boolean)
                      }
                      disabled={disabled}
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

                  {isSelected && mappingIndex !== -1 && (
                    <div className="ml-6 flex items-center space-x-0">
                      <FormField
                        control={form.control}
                        name={`mappings.${mappingIndex}.type`}
                        render={({ field: typeField }) => (
                          <FormItem>
                            <FormLabel>Fill From</FormLabel>
                            <Select
                              onValueChange={typeField.onChange}
                              defaultValue={typeField.value}
                              disabled={disabled}
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

                      <SchemaToArgumentMapSelectorValue
                        mappingIndex={mappingIndex}
                        currentType={currentType}
                        sourceFields={sourceFields}
                        disabled={disabled}
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
