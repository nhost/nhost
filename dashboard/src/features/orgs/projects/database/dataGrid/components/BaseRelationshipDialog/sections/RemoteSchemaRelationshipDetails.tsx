import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Textarea } from '@/components/ui/v3/textarea';
import { useTableSchemaQuery } from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery';
import type { RemoteSchemaRelationshipFormValues } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import RootOperationFields from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/RootOperationFields';
import SelectedFieldTree from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/SelectedFieldTree';
import type { RemoteFieldArgumentMappingsByPath } from '@/features/orgs/projects/database/dataGrid/types/relationships/relationships';
import { buildRemoteFieldFromSelection } from '@/features/orgs/projects/database/dataGrid/utils/buildRemoteFieldFromSelection';
import extractLhsFieldsFromMappings from '@/features/orgs/projects/database/dataGrid/utils/extractLhsFieldsFromMappings/extractLhsFieldsFromMappings';
import { parseRemoteFieldToSelection } from '@/features/orgs/projects/database/dataGrid/utils/parseRemoteFieldToSelection';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
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

  const { data: fromTableData } = useTableSchemaQuery(
    [
      `${selectedFromSource?.source}.${selectedFromSource?.schema}.${selectedFromSource?.table}`,
    ],
    {
      dataSource: selectedFromSource?.source,
      schema: selectedFromSource?.schema,
      table: selectedFromSource?.table,
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

  const getRemoteFieldsContent = () => {
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
          <RootOperationFields
            graphqlSchema={targetGraphqlSchema}
            selectedRootFieldPath={selectedRootFieldPath}
            onRootFieldChange={(rootFieldPath) => {
              if (rootFieldPath === null) {
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
        </div>

        {selectedRootFieldPath && (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="font-medium text-sm">Selected field tree</div>
            <SelectedFieldTree
              graphqlSchema={targetGraphqlSchema}
              selectedRootFieldPath={selectedRootFieldPath}
              selectedFieldPaths={selectedFieldPaths}
              setSelectedFieldPaths={setSelectedFieldPaths}
              argumentMappingsByPath={argumentMappingsByPath}
              setArgumentMappingsByPath={setArgumentMappingsByPath}
              tableColumnOptions={tableColumnOptions}
              disabled={disabled}
            />
          </div>
        )}
      </div>
    );
  };

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

      {getRemoteFieldsContent()}
    </div>
  );
}
