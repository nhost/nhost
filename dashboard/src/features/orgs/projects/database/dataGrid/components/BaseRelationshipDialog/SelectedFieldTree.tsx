import type { GraphQLSchema } from 'graphql';
import type { Dispatch, SetStateAction } from 'react';
import type { RemoteFieldArgumentMappingsByPath } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import RemoteSchemaFieldNode from './RemoteSchemaFieldNode';

interface SelectedFieldTreeProps {
  graphqlSchema: GraphQLSchema;
  selectedRootFieldPath: string;
  selectedFieldPaths: Set<string>;
  setSelectedFieldPaths: Dispatch<SetStateAction<Set<string>>>;
  argumentMappingsByPath: RemoteFieldArgumentMappingsByPath;
  setArgumentMappingsByPath: Dispatch<
    SetStateAction<RemoteFieldArgumentMappingsByPath>
  >;
  tableColumnOptions: string[];
  disabled?: boolean;
}

export default function SelectedFieldTree({
  graphqlSchema,
  selectedRootFieldPath,
  selectedFieldPaths,
  setSelectedFieldPaths,
  argumentMappingsByPath,
  setArgumentMappingsByPath,
  tableColumnOptions,
  disabled,
}: SelectedFieldTreeProps) {
  const queryType = graphqlSchema.getQueryType();
  const mutationType = graphqlSchema.getMutationType();
  const subscriptionType = graphqlSchema.getSubscriptionType();
  const rootField =
    queryType?.getFields()[selectedRootFieldPath] ??
    mutationType?.getFields()[selectedRootFieldPath] ??
    subscriptionType?.getFields()[selectedRootFieldPath];

  if (!rootField) {
    return (
      <p className="text-muted-foreground text-sm">
        Unable to resolve the selected root field.
      </p>
    );
  }

  return (
    <RemoteSchemaFieldNode
      schema={graphqlSchema}
      field={rootField}
      fieldPath={selectedRootFieldPath}
      selectedFieldPaths={selectedFieldPaths}
      setSelectedFieldPaths={setSelectedFieldPaths}
      argumentMappingsByPath={argumentMappingsByPath}
      setArgumentMappingsByPath={setArgumentMappingsByPath}
      tableColumnOptions={tableColumnOptions}
      disabled={disabled}
      depth={0}
    />
  );
}
