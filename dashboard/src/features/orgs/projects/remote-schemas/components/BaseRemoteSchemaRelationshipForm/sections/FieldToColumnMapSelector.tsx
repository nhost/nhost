import { isObjectType } from 'graphql';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { Text } from '@/components/ui/v2/Text';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';
import FieldToColumnMapSelectorItem from './FieldToColumnMapSelectorItem';

export interface FieldToColumnMapSelectorProps {
  sourceSchema: string;
  disabled?: boolean;
}

export default function FieldToColumnMapSelector({
  sourceSchema,
  disabled,
}: FieldToColumnMapSelectorProps) {
  const form = useFormContext<DatabaseRelationshipFormValues>();

  const tableInfo = form.watch('table');
  const { schema, name: table } = tableInfo;

  const selectedSourceType = form.watch('sourceType');

  const { data: introspectionData } = useIntrospectRemoteSchemaQuery(
    sourceSchema,
    {
      queryOptions: {
        enabled: !!sourceSchema,
      },
    },
  );

  const sourceFields =
    introspectionData && selectedSourceType
      ? (() => {
          const graphqlSchema = convertIntrospectionToSchema(introspectionData);

          if (!graphqlSchema) {
            return [];
          }

          const type = graphqlSchema.getType(selectedSourceType);

          if (isObjectType(type)) {
            const typeFields = type.getFields();
            return Object.keys(typeFields).map((fieldName) => ({
              label: fieldName,
              value: fieldName,
              type: typeFields[fieldName].type.toString(),
            }));
          }

          return [];
        })()
      : [];

  const { data } = useTableSchemaQuery([`default.${schema}.${table}`], {
    schema,
    table,
    queryOptions: {
      enabled: !!schema && !!table,
    },
  });

  const columns =
    data?.columns
      ?.map((column) => (column.column_name as string) ?? null)
      .filter(Boolean) ?? [];

  const { fields, append, remove } =
    useFieldArray<DatabaseRelationshipFormValues>({
      name: 'fieldMapping',
    });

  return (
    <Box className="mx-2 space-y-4 rounded border-1 p-4">
      <Box className="flex flex-col space-y-4">
        <Box className="grid grid-cols-8 items-center gap-4">
          <Text className="col-span-3">Source Field</Text>
          <div className="col-span-1" />
          <Text className="col-span-3">Reference Column</Text>
          <Button
            variant="borderless"
            className="col-span-1"
            onClick={() => append({ sourceField: '', referenceColumn: '' })}
            disabled={disabled}
          >
            <PlusIcon className="h-5 w-5" />
          </Button>
        </Box>

        {fields.map((field, index) => (
          <Box key={field.id} className="grid grid-cols-8 items-center gap-4">
            <FieldToColumnMapSelectorItem
              columns={columns}
              sourceFields={sourceFields}
              itemIndex={index}
              disabled={disabled}
            />

            <Button
              variant="borderless"
              className="col-span-1"
              color="error"
              onClick={() => remove(index)}
              disabled={disabled}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
