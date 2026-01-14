import { Checkbox } from '@/components/ui/v3/checkbox';
import { Textarea } from '@/components/ui/v3/textarea';
import RemoteSchemaFieldNode from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/RemoteSchemaFieldNode';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { RemoteFieldArgumentMappingsByPath } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import extractLhsFieldsFromMappings from '@/features/orgs/projects/database/dataGrid/utils/extractLhsFieldsFromMappings/extractLhsFieldsFromMappings';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import buildRemoteFieldFromSelection from '@/features/orgs/projects/remote-schemas/utils/buildRemoteFieldFromSelection';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import getOperationRoots from '@/features/orgs/projects/remote-schemas/utils/getOperationRoots';
import getTypeString from '@/features/orgs/projects/remote-schemas/utils/getTypeString';
import type { RemoteField } from '@/utils/hasura-api/generated/schemas';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface RemoteSchemaRelationshipDetailsValue {
  lhsFields: string[];
  remoteField?: RemoteField;
}

export interface RemoteSchemaRelationshipDetailsInitialValue {
  rootFieldPath: string;
  selectedFieldPaths: Set<string>;
  argumentMappingsByPath: RemoteFieldArgumentMappingsByPath;
}

export interface RemoteSchemaRelationshipDetailsProps {
  remoteSchema: string;
  tableColumns: NormalizedQueryDataRow[];
  disabled?: boolean;
  onChange: (value: RemoteSchemaRelationshipDetailsValue) => void;
  initialValue?: RemoteSchemaRelationshipDetailsInitialValue;
}

export default function RemoteSchemaRelationshipDetails({
  remoteSchema,
  tableColumns,
  disabled,
  onChange,
  initialValue,
}: RemoteSchemaRelationshipDetailsProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [selectedRootFieldPath, setSelectedRootFieldPath] = useState(
    initialValue?.rootFieldPath ?? '',
  );
  const [selectedFieldPaths, setSelectedFieldPaths] = useState<Set<string>>(
    initialValue?.selectedFieldPaths ?? new Set(),
  );
  const [argumentMappingsByPath, setArgumentMappingsByPath] =
    useState<RemoteFieldArgumentMappingsByPath>(
      initialValue?.argumentMappingsByPath ?? {},
    );

  // Track the previous remoteSchema to detect changes
  const previousRemoteSchemaRef = useRef(remoteSchema);

  const tableColumnOptions = useMemo(
    () =>
      tableColumns
        .map((column) => column?.column_name)
        .filter((columnName): columnName is string => Boolean(columnName)),
    [tableColumns],
  );

  const { data: targetIntrospectionData } = useIntrospectRemoteSchemaQuery(
    remoteSchema,
    {
      queryOptions: {
        enabled: !!remoteSchema,
      },
    },
  );

  const targetGraphqlSchema = useMemo(() => {
    if (!targetIntrospectionData) {
      return null;
    }
    return convertIntrospectionToSchema(targetIntrospectionData);
  }, [targetIntrospectionData]);

  useEffect(() => {
    // Only reset if remoteSchema actually changed (not on initial mount)
    if (previousRemoteSchemaRef.current !== remoteSchema) {
      setSelectedRootFieldPath('');
      setSelectedFieldPaths(new Set());
      setArgumentMappingsByPath({});
      onChangeRef.current({ lhsFields: [], remoteField: undefined });
      previousRemoteSchemaRef.current = remoteSchema;
    }
  }, [remoteSchema]);

  const remoteFieldObject = useMemo(() => {
    if (selectedFieldPaths.size === 0) {
      return null;
    }

    return buildRemoteFieldFromSelection(
      selectedFieldPaths,
      argumentMappingsByPath,
    );
  }, [argumentMappingsByPath, selectedFieldPaths]);

  const lhsFields = useMemo(
    () => extractLhsFieldsFromMappings(argumentMappingsByPath),
    [argumentMappingsByPath],
  );

  useEffect(() => {
    if (!remoteFieldObject) {
      onChangeRef.current({ lhsFields, remoteField: undefined });
      return;
    }

    onChangeRef.current({ lhsFields, remoteField: remoteFieldObject });
  }, [lhsFields, remoteFieldObject]);

  const remoteFieldsContent = useMemo(() => {
    if (!remoteSchema) {
      return (
        <p className="text-muted-foreground text-sm">
          Select a remote schema to browse available fields.
        </p>
      );
    }

    if (!targetGraphqlSchema) {
      return (
        <p className="text-muted-foreground text-sm">
          Loading remote schema types...
        </p>
      );
    }

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="font-medium text-sm">Root operation fields</div>
          {getOperationRoots(targetGraphqlSchema).map((root) => {
            const rootFields = Object.values(root.type.getFields());
            return (
              <div
                key={root.value}
                className="space-y-2 rounded-md border border-border p-3"
              >
                <div className="font-semibold text-sm">{root.label}</div>
                <div className="space-y-2">
                  {rootFields.map((rootField) => {
                    const rootFieldPath = rootField.name;
                    const checked = selectedRootFieldPath === rootFieldPath;
                    return (
                      <div
                        key={`${root.value}.${rootField.name}`}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          id={`root-${root.value}-${rootField.name}`}
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            const shouldSelect = Boolean(nextChecked);
                            if (!shouldSelect) {
                              setSelectedRootFieldPath('');
                              setSelectedFieldPaths(new Set());
                              setArgumentMappingsByPath({});
                              return;
                            }

                            setSelectedRootFieldPath(rootFieldPath);
                            setSelectedFieldPaths(new Set([rootFieldPath]));
                            setArgumentMappingsByPath({});
                          }}
                          disabled={disabled}
                        />
                        <label
                          htmlFor={`root-${root.value}-${rootField.name}`}
                          className="cursor-pointer text-sm"
                        >
                          <span className="font-medium">{rootField.name}</span>{' '}
                          <span className="text-xs text-muted-foreground">
                            ({getTypeString(rootField.type)})
                          </span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {selectedRootFieldPath ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-sm font-medium">Selected field tree</div>
            {(() => {
              const graphqlSchema = targetGraphqlSchema;
              const queryType = graphqlSchema.getQueryType();
              const mutationType = graphqlSchema.getMutationType();
              const subscriptionType = graphqlSchema.getSubscriptionType();
              const rootField =
                queryType?.getFields()[selectedRootFieldPath] ??
                mutationType?.getFields()[selectedRootFieldPath] ??
                subscriptionType?.getFields()[selectedRootFieldPath];

              if (!rootField) {
                return (
                  <p className="text-sm text-muted-foreground">
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
            })()}
          </div>
        ) : null}
      </div>
    );
  }, [
    argumentMappingsByPath,
    disabled,
    remoteSchema,
    selectedRootFieldPath,
    selectedFieldPaths,
    tableColumnOptions,
    targetGraphqlSchema,
  ]);

  const remoteFieldPreview = remoteFieldObject
    ? JSON.stringify(remoteFieldObject, null, 2)
    : '{}';

  return (
    <div className="space-y-4">
      {remoteFieldsContent}

      <div className="space-y-2">
        <div className="text-sm font-medium">Remote field preview</div>
        <Textarea
          value={remoteFieldPreview}
          readOnly
          className="font-mono text-xs"
          rows={8}
        />
      </div>
    </div>
  );
}
