import { isObjectType } from 'graphql';
import { PlusIcon, Trash2 as TrashIcon } from 'lucide-react';
import { useFieldArray, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import type { DatabaseRelationshipFormValues } from './DatabaseRelationshipForm';
import FieldToColumnMapSelectorItem from './FieldToColumnMapSelectorItem';

export interface FieldToColumnMapSelectorProps {
  sourceSchema: string;
}

export default function FieldToColumnMapSelector({
  sourceSchema,
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
    <div className="box mx-2 space-y-4 rounded border-1 p-4">
      <div className="flex flex-col space-y-4">
        <div className="grid grid-cols-8 items-center gap-4">
          <span className="col-span-3">Source Field</span>
          <div className="col-span-1" />
          <span className="col-span-3">Reference Column</span>
          <Button
            variant="ghost"
            size="icon"
            className="col-span-1"
            aria-label="Add field mapping"
            onClick={() => append({ sourceField: '', referenceColumn: '' })}
          >
            <PlusIcon className="h-5 w-5" />
          </Button>
        </div>

        {fields.map((field, index) => (
          <div key={field.id} className="grid grid-cols-8 items-center gap-4">
            <FieldToColumnMapSelectorItem
              columns={columns}
              sourceFields={sourceFields}
              itemIndex={index}
            />

            <Button
              className="col-span-1 text-destructive hover:text-destructive"
              aria-label="Remove field mapping"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
