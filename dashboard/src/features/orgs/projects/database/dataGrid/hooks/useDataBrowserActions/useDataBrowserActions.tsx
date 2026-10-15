import { useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { useRouter } from 'next/router';
import { type ComponentProps, lazy, Suspense, useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { Badge } from '@/components/ui/v3/badge';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { EXPORT_METADATA_QUERY_KEY } from '@/features/orgs/projects/common/hooks/useExportMetadata';
import { useDeleteDatabaseObjectWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteDatabaseObjectMutation';
import type {
  DatabaseObjectType,
  DatabaseObjectViewModel,
  TableLikeObjectType,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getObjectTypeUrlSegment } from '@/features/orgs/projects/database/dataGrid/utils/getObjectTypeUrlSegment';
import { ALL_TABLE_COLUMNS_QUERY_KEY } from '@/features/orgs/projects/database/schema-diagram/useAllTableColumns';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';

const objectTypeLabels: Record<DatabaseObjectType, string> = {
  'ORDINARY TABLE': 'Table',
  VIEW: 'View',
  'MATERIALIZED VIEW': 'Materialized View',
  'FOREIGN TABLE': 'Foreign Table',
  FUNCTION: 'Function',
};

const deleteObjectTypeLabels: Record<
  DatabaseObjectType,
  { label: string; title: string }
> = {
  'MATERIALIZED VIEW': {
    label: 'materialized view',
    title: 'Delete Materialized View',
  },
  VIEW: { label: 'view', title: 'Delete View' },
  'ORDINARY TABLE': { label: 'table', title: 'Delete Table' },
  'FOREIGN TABLE': { label: 'foreign table', title: 'Delete Table' },
  FUNCTION: { label: 'function', title: 'Delete Function' },
};

const CreateTableFormLazy = lazy(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/CreateTableForm/CreateTableForm'
    ),
);

function CreateTableForm(props: ComponentProps<typeof CreateTableFormLazy>) {
  return (
    <Suspense fallback={<FormActivityIndicator />}>
      <CreateTableFormLazy {...props} />
    </Suspense>
  );
}

const EditTableFormLazy = lazy(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditTableForm/EditTableForm'
    ),
);

function EditTableForm(props: ComponentProps<typeof EditTableFormLazy>) {
  return (
    <Suspense fallback={<FormActivityIndicator />}>
      <EditTableFormLazy {...props} />
    </Suspense>
  );
}

const ViewDefinitionViewLazy = lazy(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/ViewDefinitionView/ViewDefinitionView'
    ),
);

function ViewDefinitionView(
  props: ComponentProps<typeof ViewDefinitionViewLazy>,
) {
  return (
    <Suspense fallback={<FormActivityIndicator />}>
      <ViewDefinitionViewLazy {...props} />
    </Suspense>
  );
}

const EditFunctionFormLazy = lazy(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditFunctionForm/EditFunctionForm'
    ),
);

function EditFunctionForm(props: ComponentProps<typeof EditFunctionFormLazy>) {
  return (
    <Suspense fallback={<FormActivityIndicator />}>
      <EditFunctionFormLazy {...props} />
    </Suspense>
  );
}

const EditFunctionGraphQLSettingsFormLazy = lazy(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditFunctionGraphQLSettingsForm/EditFunctionGraphQLSettingsForm'
    ),
);

function EditFunctionGraphQLSettingsForm(
  props: ComponentProps<typeof EditFunctionGraphQLSettingsFormLazy>,
) {
  return (
    <Suspense fallback={<FormActivityIndicator />}>
      <EditFunctionGraphQLSettingsFormLazy {...props} />
    </Suspense>
  );
}

const EditPermissionsFormLazy = lazy(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/EditPermissionsForm'
    ),
);

function EditPermissionsForm(
  props: ComponentProps<typeof EditPermissionsFormLazy>,
) {
  return (
    <Suspense fallback={<FormActivityIndicator />}>
      <EditPermissionsFormLazy {...props} />
    </Suspense>
  );
}

const EditFunctionPermissionsFormLazy = lazy(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditFunctionPermissionsForm/EditFunctionPermissionsForm'
    ),
);

function EditFunctionPermissionsForm(
  props: ComponentProps<typeof EditFunctionPermissionsFormLazy>,
) {
  return (
    <Suspense fallback={<FormActivityIndicator />}>
      <EditFunctionPermissionsFormLazy {...props} />
    </Suspense>
  );
}

const EditGraphQLSettingsFormLazy = lazy(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditGraphQLSettingsForm/EditGraphQLSettingsForm'
    ),
);

function EditGraphQLSettingsForm(
  props: ComponentProps<typeof EditGraphQLSettingsFormLazy>,
) {
  return (
    <Suspense fallback={<FormActivityIndicator />}>
      <EditGraphQLSettingsFormLazy {...props} />
    </Suspense>
  );
}

const EditRelationshipsFormLazy = lazy(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditRelationshipsForm/EditRelationshipsForm'
    ),
);

function EditRelationshipsForm(
  props: ComponentProps<typeof EditRelationshipsFormLazy>,
) {
  return (
    <Suspense fallback={<FormActivityIndicator />}>
      <EditRelationshipsFormLazy {...props} />
    </Suspense>
  );
}

export interface UseDataBrowserActionsParams {
  dataSourceSlug: string;
  schemaSlug?: string;
  tableSlug?: string;
  functionOID?: string;
  selectedSchema: string;
  refetchDatabaseQuery: () => Promise<unknown>;
  allObjects: DatabaseObjectViewModel[];
  /**
   * When provided, the "Create a New Table" drawer renders a schema picker
   * so the user can choose where the table will be created. Useful in
   * contexts where there is no ambient selected schema (e.g. the schema
   * navigator).
   */
  availableSchemas?: string[];
  /**
   * Callback invoked after a new table has been created and tracked.
   * When provided, the drawer's default redirect to the data browser is
   * suppressed and the caller takes over the post-create flow (e.g.
   * highlighting the new node in the schema diagram).
   */
  onTableCreated?: (info: { schema: string; name: string }) => void;
}

export function useDataBrowserActions({
  dataSourceSlug,
  schemaSlug,
  tableSlug,
  functionOID,
  selectedSchema,
  refetchDatabaseQuery,
  allObjects,
  availableSchemas,
  onTableCreated,
}: UseDataBrowserActionsParams) {
  const queryClient = useQueryClient();
  const { openDrawer, openAlertDialog } = useDialog();
  const router = useRouter();
  const navigate = useNavigate();
  const { orgSlug, appSubdomain } = useParams({ strict: false });
  const { project } = useProject();
  const { mutateAsync: deleteDatabaseObject } =
    useDeleteDatabaseObjectWithToastMutation({ dataSource: dataSourceSlug });

  const [removableObject, setRemovableObject] = useState<string>();
  const [optimisticlyRemovedObject, setOptimisticlyRemovedObject] =
    useState<string>();
  const [sidebarMenuObject, setSidebarMenuObject] = useState<string>();

  async function handleDeleteDatabaseObjectConfirmation(
    schema: string,
    name: string,
    objectType: DatabaseObjectType,
    oid?: string,
  ) {
    const tableLikeObjectKey = `${schema}.${name}`;
    const isFunction = objectType === 'FUNCTION';
    const functionKey = `FUNCTION.${schema}.${oid}`;

    const removableObjectKey = isFunction ? functionKey : tableLikeObjectKey;
    setRemovableObject(removableObjectKey);

    try {
      let nextObjectIndex: number | null = null;

      if (isNotEmptyValue(allObjects) && allObjects.length > 1) {
        const currentObjectIndex = isFunction
          ? allObjects.findIndex(
              (obj) => obj.objectType === 'FUNCTION' && obj.oid === oid,
            )
          : allObjects.findIndex(
              (obj) => `${obj.schema}.${obj.name}` === tableLikeObjectKey,
            );

        nextObjectIndex = currentObjectIndex + 1;

        if (currentObjectIndex + 1 === allObjects.length) {
          nextObjectIndex = currentObjectIndex - 1;
        }
      }

      const nextObject =
        isNotEmptyValue(nextObjectIndex) && isNotEmptyValue(allObjects)
          ? allObjects[nextObjectIndex]
          : null;

      await deleteDatabaseObject({
        schema,
        objectName: name,
        type: objectType,
        functionOID: oid,
      });

      const queryKey = isFunction
        ? ['function-definition', `${dataSourceSlug}.${oid}`]
        : [`${dataSourceSlug}.${schema}.${name}`];

      queryClient.removeQueries({ queryKey });

      setOptimisticlyRemovedObject(removableObjectKey);

      await refetchDatabaseQuery();

      await queryClient.refetchQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
      });

      queryClient.invalidateQueries({
        queryKey: [ALL_TABLE_COLUMNS_QUERY_KEY, project?.subdomain],
      });

      if (!nextObject) {
        await navigate({
          from: '/orgs/$orgSlug/projects/$appSubdomain',
          to: '/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug',
          params: (prev) => ({ ...prev, dataSourceSlug: dataSourceSlug }),
        });

        return;
      }

      const isCurrentlyActive = isFunction
        ? oid === functionOID
        : schema === schemaSlug && name === tableSlug;

      if (isCurrentlyActive) {
        const urlSegment = getObjectTypeUrlSegment(nextObject.objectType);
        const nextSlug =
          nextObject.objectType === 'FUNCTION'
            ? nextObject.oid
            : nextObject.name;
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}/${nextObject.schema}/${urlSegment}/${nextSlug}`,
        );
      }
    } catch {
      // TODO: Introduce logging
    } finally {
      setRemovableObject(undefined);
      setOptimisticlyRemovedObject(undefined);
    }
  }

  function handleDeleteDatabaseObject(
    schema: string,
    name: string,
    objectType: DatabaseObjectType,
    oid?: string,
  ) {
    const { label: objectLabel, title } =
      deleteObjectTypeLabels[objectType] ??
      deleteObjectTypeLabels['ORDINARY TABLE'];

    openAlertDialog({
      title,
      payload: (
        <span>
          Are you sure you want to delete the{' '}
          <strong className="break-all">{name}</strong> {objectLabel}?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: () =>
          handleDeleteDatabaseObjectConfirmation(schema, name, objectType, oid),
      },
    });
  }

  function handleEditPermission(
    schema: string,
    table: string,
    objectType?: DatabaseObjectType,
    updatability?: number,
  ) {
    const typeLabel = objectType ? objectTypeLabels[objectType] : 'Table';

    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Permissions for
          <InlineCode className="!text-sm+ font-normal">{table}</InlineCode>
          {typeLabel}
          <Badge
            variant="secondary"
            className="bg-primary-highlight text-primary"
          >
            Preview
          </Badge>
        </span>
      ),
      component: (
        <EditPermissionsForm
          schema={schema}
          table={table}
          objectType={objectType}
          updatability={updatability}
        />
      ),
      props: {
        PaperProps: {
          className: 'overflow-hidden lg:w-[65%] lg:max-w-7xl',
        },
      },
    });
  }

  function handleEditFunctionPermission(
    schema: string,
    functionName: string,
    oid?: string,
    disabled?: boolean,
  ) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Permissions for
          <InlineCode className="!text-sm+ font-normal">
            {functionName}
          </InlineCode>
          Function
        </span>
      ),
      component: (
        <EditFunctionPermissionsForm
          disabled={disabled}
          schema={schema}
          functionName={functionName}
          functionOID={oid}
        />
      ),
      props: {
        PaperProps: {
          className: 'lg:w-[65%] lg:max-w-7xl',
        },
      },
    });
  }

  function handleEditGraphQLSettings(
    schema: string,
    name: string,
    objectType?: DatabaseObjectType,
    oid?: string,
  ) {
    const typeLabel = objectType
      ? objectTypeLabels[objectType].toLowerCase()
      : 'table';

    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Edit GraphQL settings for
          <InlineCode className="!text-sm+ font-normal">{name}</InlineCode>
          {typeLabel}
        </span>
      ),
      component:
        objectType === 'FUNCTION' ? (
          <EditFunctionGraphQLSettingsForm
            schema={schema}
            functionName={name}
            functionOID={oid}
          />
        ) : (
          <EditGraphQLSettingsForm
            objectType={objectType}
            schema={schema}
            tableName={name}
          />
        ),
      props: {
        PaperProps: {
          className: 'overflow-hidden ',
        },
      },
    });
  }

  async function handleCreateTableSubmit(info: {
    schema: string;
    name: string;
  }) {
    await Promise.all([
      queryClient.refetchQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
      }),
      refetchDatabaseQuery(),
      queryClient.refetchQueries({
        queryKey: [ALL_TABLE_COLUMNS_QUERY_KEY, project?.subdomain],
      }),
    ]);
    onTableCreated?.(info);
  }

  async function handleEditTableSubmit(schema: string, tableName: string) {
    await Promise.all([
      queryClient.refetchQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
      }),
      refetchDatabaseQuery(),
      queryClient.refetchQueries({
        queryKey: [`${dataSourceSlug}.${schema}.${tableName}`],
      }),
      queryClient.invalidateQueries({
        queryKey: [ALL_TABLE_COLUMNS_QUERY_KEY, project?.subdomain],
      }),
    ]);
  }

  function openEditTableDrawer(schema: string, tableName: string) {
    openDrawer({
      title: 'Edit Table',
      component: (
        <EditTableForm
          onSubmit={(name) => handleEditTableSubmit(schema, name)}
          schema={schema}
          tableName={tableName}
        />
      ),
      props: {
        PaperProps: { className: '[overflow-y:initial]' },
      },
    });
  }

  function openEditViewDrawer(
    schema: string,
    viewName: string,
    objectType: TableLikeObjectType,
  ) {
    const isMaterializedView = objectType === 'MATERIALIZED VIEW';
    openDrawer({
      title: isMaterializedView
        ? 'Materialized View Definition'
        : 'View Definition',
      component: (
        <ViewDefinitionView
          schema={schema}
          table={viewName}
          dataSource={dataSourceSlug}
        />
      ),
    });
  }

  function openEditFunctionDrawer(
    schema: string,
    functionName: string,
    oid: string,
  ) {
    openDrawer({
      title: 'Function Definition',
      component: (
        <EditFunctionForm
          schema={schema}
          functionName={functionName}
          functionOID={oid}
          dataSource={dataSourceSlug}
        />
      ),
    });
  }

  function handleEditRelationships(schema: string, table: string) {
    openDrawer({
      title: 'Edit Relationships',
      component: <EditRelationshipsForm schema={schema} table={table} />,
      props: {
        PaperProps: {
          className: 'overflow-hidden',
        },
      },
    });
  }

  function openCreateTableDrawer() {
    openDrawer({
      title: 'Create a New Table',
      component: (
        <CreateTableForm
          onSubmit={handleCreateTableSubmit}
          schema={selectedSchema}
          availableSchemas={availableSchemas}
          redirectOnSuccess={!onTableCreated}
        />
      ),
      props: {
        PaperProps: { className: '[overflow-y:initial]' },
      },
    });
  }

  return {
    removableObject,
    optimisticlyRemovedObject,
    sidebarMenuObject,
    setSidebarMenuObject,
    handleDeleteDatabaseObject,
    handleEditPermission,
    handleEditFunctionPermission,
    handleEditGraphQLSettings,
    handleEditRelationships,
    openEditTableDrawer,
    openEditViewDrawer,
    openEditFunctionDrawer,
    openCreateTableDrawer,
  };
}

export default useDataBrowserActions;
