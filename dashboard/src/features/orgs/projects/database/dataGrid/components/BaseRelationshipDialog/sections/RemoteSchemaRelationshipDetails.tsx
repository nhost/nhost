import { useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Textarea } from '@/components/ui/v3/textarea';
import RemoteSchemaFieldNode from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/RemoteSchemaFieldNode';
import type { RemoteFieldArgumentMappingsByPath } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import extractLhsFieldsFromMappings from '@/features/orgs/projects/database/dataGrid/utils/extractLhsFieldsFromMappings/extractLhsFieldsFromMappings';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import buildRemoteFieldFromSelection from '@/features/orgs/projects/remote-schemas/utils/buildRemoteFieldFromSelection';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import getOperationRoots from '@/features/orgs/projects/remote-schemas/utils/getOperationRoots';
import getTypeString from '@/features/orgs/projects/remote-schemas/utils/getTypeString';
import parseRemoteFieldToSelection from '@/features/orgs/projects/remote-schemas/utils/parseRemoteFieldToSelection';
import type { RemoteField } from '@/utils/hasura-api/generated/schemas';
import { useTableQuery } from '../../../hooks/useTableQuery';
import type { RemoteSchemaRelationshipFormValues } from '../BaseRelationshipFormTypes';

export interface RemoteSchemaRelationshipDetailsValue {
  lhsFields: string[];
  remoteField?: RemoteField;
}

export interface RemoteSchemaRelationshipDetailsProps {
  disabled?: boolean;
  onChange: (value: RemoteSchemaRelationshipDetailsValue) => void;
  initialRemoteField?: RemoteField;
}

export default function RemoteSchemaRelationshipDetails({
  disabled,
  onChange,
  initialRemoteField,
}: RemoteSchemaRelationshipDetailsProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const [selectedRootFieldPath, setSelectedRootFieldPath] = useState('');
  const [selectedFieldPaths, setSelectedFieldPaths] = useState<Set<string>>(
    new Set(),
  );

  const form = useFormContext<RemoteSchemaRelationshipFormValues>();

  const { watch } = form;

  const remoteSchema = watch('remoteSchema.name');
  const selectedFromSource = watch('fromSource');
  
  const { data: fromTableData } = useTableQuery(
    [
      `${selectedFromSource?.source}.${selectedFromSource?.schema}.${selectedFromSource?.table}`,
    ],
    {
      dataSource: selectedFromSource?.source,
      schema: selectedFromSource?.schema,
      table: selectedFromSource?.table,
      queryOptions: {
        enabled:
          Boolean(
            selectedFromSource?.source &&
              selectedFromSource?.schema &&
              selectedFromSource?.table,
          ),
      },
    },
  );

  const tableColumnOptions = fromTableData?.columns
    ?.map((column) => column?.column_name)
    .filter((columnName): columnName is string => Boolean(columnName)) ?? []

  const [argumentMappingsByPath, setArgumentMappingsByPath] =
    useState<RemoteFieldArgumentMappingsByPath>({});

  // Track the previous remoteSchema to detect changes
  const previousRemoteSchemaRef = useRef(remoteSchema);
  
  // Track the previous initialRemoteField to detect changes
  const previousInitialRemoteFieldRef = useRef(initialRemoteField);
  
  // Track if we've initialized from initialRemoteField
  const hasInitializedRef = useRef(false);

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

  // Initialize from initialRemoteField on mount or when it becomes available
  useEffect(() => {
    if (initialRemoteField && previousInitialRemoteFieldRef.current !== initialRemoteField) {
      const parsed = parseRemoteFieldToSelection(initialRemoteField);
      setSelectedRootFieldPath(parsed.rootFieldPath);
      setSelectedFieldPaths(parsed.selectedFieldPaths);
      setArgumentMappingsByPath(parsed.argumentMappingsByPath);
      hasInitializedRef.current = true;
      previousInitialRemoteFieldRef.current = initialRemoteField;
    }
  }, [initialRemoteField]);

  useEffect(() => {
    // Reset if remoteSchema changed (not on initial mount)
    if (previousRemoteSchemaRef.current !== remoteSchema) {
      setSelectedRootFieldPath('');
      setSelectedFieldPaths(new Set());
      setArgumentMappingsByPath({});
      onChangeRef.current({ lhsFields: [], remoteField: undefined });
      previousRemoteSchemaRef.current = remoteSchema;
      previousInitialRemoteFieldRef.current = undefined;
      hasInitializedRef.current = false;
      
      // If we have an initialRemoteField for the new schema, initialize from it
      if (initialRemoteField) {
        const parsed = parseRemoteFieldToSelection(initialRemoteField);
        setSelectedRootFieldPath(parsed.rootFieldPath);
        setSelectedFieldPaths(parsed.selectedFieldPaths);
        setArgumentMappingsByPath(parsed.argumentMappingsByPath);
        hasInitializedRef.current = true;
        previousInitialRemoteFieldRef.current = initialRemoteField;
      }
    }
  }, [remoteSchema, initialRemoteField]);

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
                          <span className="text-muted-foreground text-xs">
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
            <div className="font-medium text-sm">Selected field tree</div>
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
        <div className="font-medium text-sm">Remote field preview</div>
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
