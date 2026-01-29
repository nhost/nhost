import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Textarea } from '@/components/ui/v3/textarea';
import type { RemoteSchemaRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import RemoteSchemaFieldNode from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/RemoteSchemaFieldNode';
import { useTableQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery';
import type { RemoteFieldArgumentMappingsByPath } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import extractLhsFieldsFromMappings from '@/features/orgs/projects/database/dataGrid/utils/extractLhsFieldsFromMappings/extractLhsFieldsFromMappings';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import buildRemoteFieldFromSelection from '@/features/orgs/projects/remote-schemas/utils/buildRemoteFieldFromSelection';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import getTypeString from '@/features/orgs/projects/remote-schemas/utils/getTypeString';
import parseRemoteFieldToSelection from '@/features/orgs/projects/remote-schemas/utils/parseRemoteFieldToSelection';
import { isEmptyValue } from '@/lib/utils';
import type { RemoteField } from '@/utils/hasura-api/generated/schemas';

export interface RemoteSchemaRelationshipDetailsValue {
  lhsFields: string[];
  remoteField?: RemoteField;
}

export default function RemoteSchemaRelationshipDetails() {
  const [selectedRootFieldPath, setSelectedRootFieldPath] = useState('');
  const [selectedFieldPaths, setSelectedFieldPaths] = useState<Set<string>>(
    new Set(),
  );

  const form = useFormContext<RemoteSchemaRelationshipFormValues>();

  const { watch, formState } = form;
  const { isSubmitting: disabled } = formState;

  const remoteSchemaFormValue = watch('remoteSchema');
  const remoteSchemaName = remoteSchemaFormValue.name;
  const initialRemoteField = remoteSchemaFormValue?.remoteField;
  const selectedFromSource = watch('fromSource');

  const { data: fromTableData } = useTableQuery(
    [
      `${selectedFromSource?.source}.${selectedFromSource?.schema}.${selectedFromSource?.table}`,
    ],
    {
      dataSource: selectedFromSource?.source,
      schema: selectedFromSource?.schema,
      table: selectedFromSource?.table,
      preventRowFetching: true,
      queryOptions: {
        enabled: Boolean(
          selectedFromSource?.source &&
            selectedFromSource?.schema &&
            selectedFromSource?.table,
        ),
      },
    },
  );

  const tableColumnOptions =
    fromTableData?.columns
      ?.map((column) => column?.column_name)
      .filter((columnName): columnName is string => Boolean(columnName)) ?? [];

  const [argumentMappingsByPath, setArgumentMappingsByPath] =
    useState<RemoteFieldArgumentMappingsByPath>({});

  const lastInitializedSchemaRef = useRef<string | undefined>(undefined);
  const lastSyncedRemoteFieldRef = useRef<string | null>(null);

  const { data: targetIntrospectionData } = useIntrospectRemoteSchemaQuery(
    remoteSchemaName,
    {
      queryOptions: {
        enabled: !!remoteSchemaName,
      },
    },
  );

  const targetGraphqlSchema = useMemo(() => {
    if (!targetIntrospectionData) {
      return null;
    }
    return convertIntrospectionToSchema(targetIntrospectionData);
  }, [targetIntrospectionData]);

  const handleRemoteFieldChange = useCallback(
    ({
      lhsFields: updatedLhsFields,
      remoteField,
    }: {
      lhsFields: string[];
      remoteField?: RemoteField;
    }) => {
      if (!remoteSchemaName) {
        return;
      }

      form.setValue(
        'remoteSchema',
        {
          name: remoteSchemaName,
          lhsFields: updatedLhsFields,
          remoteField,
        },
        { shouldDirty: true, shouldValidate: true },
      );
    },
    [form, remoteSchemaName],
  );

  const prevSchemaRef = lastInitializedSchemaRef.current;
  if (remoteSchemaName !== prevSchemaRef) {
    lastInitializedSchemaRef.current = remoteSchemaName;
    lastSyncedRemoteFieldRef.current = null;
    if (prevSchemaRef !== undefined) {
      setSelectedRootFieldPath('');
      setSelectedFieldPaths(new Set());
      setArgumentMappingsByPath({});
    }
    if (initialRemoteField && remoteSchemaName) {
      const parsed = parseRemoteFieldToSelection(initialRemoteField);
      setSelectedRootFieldPath(parsed.rootFieldPath);
      setSelectedFieldPaths(parsed.selectedFieldPaths);
      setArgumentMappingsByPath(parsed.argumentMappingsByPath);
    }
  }

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
    const nextRemoteFieldSerialized =
      remoteFieldObject == null
        ? ''
        : JSON.stringify({ lhsFields, remoteField: remoteFieldObject });

    if (lastSyncedRemoteFieldRef.current === nextRemoteFieldSerialized) {
      return;
    }
    lastSyncedRemoteFieldRef.current = nextRemoteFieldSerialized;

    if (!remoteFieldObject) {
      handleRemoteFieldChange({ lhsFields, remoteField: undefined });
      return;
    }

    handleRemoteFieldChange({ lhsFields, remoteField: remoteFieldObject });
  }, [lhsFields, remoteFieldObject, handleRemoteFieldChange]);

  const remoteFieldsContent = useMemo(() => {
    if (!remoteSchemaName) {
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
          {(() => {
            const queryRoot = targetGraphqlSchema.getQueryType();
            if (isEmptyValue(queryRoot)) {
              return (
                <p className="text-muted-foreground text-sm">
                  No Query type found in the remote schema.
                </p>
              );
            }

            const rootFields = Object.values(queryRoot!.getFields());
            if (rootFields.length === 0) {
              return (
                <p className="text-muted-foreground text-sm">
                  No fields found in the Query type.
                </p>
              );
            }

            return (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="font-semibold text-sm">Query</div>
                <div className="space-y-2">
                  {rootFields.map((rootField) => {
                    const rootFieldPath = rootField.name;
                    const checked = selectedRootFieldPath === rootFieldPath;
                    return (
                      <div
                        key={rootField.name}
                        className="flex items-center gap-3"
                      >
                        <Checkbox
                          id={`root-query-${rootField.name}`}
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
                          htmlFor={`root-query-${rootField.name}`}
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
          })()}
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
    remoteSchemaName,
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
      <div className="space-y-2">
        <div className="font-medium text-sm">Remote field preview</div>
        <Textarea
          value={remoteFieldPreview}
          readOnly
          className="font-mono text-xs"
          rows={8}
        />
      </div>

      {remoteFieldsContent}
    </div>
  );
}
