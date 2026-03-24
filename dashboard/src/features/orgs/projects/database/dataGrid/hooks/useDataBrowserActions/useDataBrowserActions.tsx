import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useState } from 'react';
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

const CreateTableForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/CreateTableForm/CreateTableForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditTableForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditTableForm/EditTableForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const ViewDefinitionView = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/ViewDefinitionView/ViewDefinitionView'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditFunctionForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditFunctionForm/EditFunctionForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditFunctionGraphQLSettingsForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditFunctionGraphQLSettingsForm/EditFunctionGraphQLSettingsForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditPermissionsForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditPermissionsForm/EditPermissionsForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditGraphQLSettingsForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditGraphQLSettingsForm/EditGraphQLSettingsForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditRelationshipsForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditRelationshipsForm/EditRelationshipsForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

export interface UseDataBrowserActionsParams {
  dataSourceSlug: string;
  schemaSlug: string | undefined;
  tableSlug: string | undefined;
  functionOID: string | undefined;
  selectedSchema: string;
  refetchDatabaseQuery: () => Promise<unknown>;
  allObjects: DatabaseObjectViewModel[];
}

export function useDataBrowserActions({
  dataSourceSlug,
  schemaSlug,
  tableSlug,
  functionOID,
  selectedSchema,
  refetchDatabaseQuery,
  allObjects,
}: UseDataBrowserActionsParams) {
  const queryClient = useQueryClient();
  const { openDrawer, openAlertDialog } = useDialog();
  const router = useRouter();
  const {
    query: { orgSlug, appSubdomain },
  } = router;
  const { project } = useProject();
  const { mutateAsync: deleteDatabaseObject } =
    useDeleteDatabaseObjectWithToastMutation();

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

    if (isFunction) {
      setRemovableObject(functionKey);
    } else {
      setRemovableObject(tableLikeObjectKey);
    }

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

      if (isFunction) {
        queryClient.removeQueries({
          queryKey: ['function-definition', `${dataSourceSlug}.${oid}`],
        });
      } else {
        queryClient.removeQueries({
          queryKey: [`${dataSourceSlug}.${schema}.${name}`],
        });
      }

      if (isFunction) {
        setOptimisticlyRemovedObject(functionKey);
      } else {
        setOptimisticlyRemovedObject(tableLikeObjectKey);
      }

      await refetchDatabaseQuery();

      await queryClient.refetchQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
      });

      if (!nextObject) {
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}`,
        );

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
            className="bg-[#ebf3ff] text-primary dark:bg-[#1b2534]"
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
          className: 'lg:w-[65%] lg:max-w-7xl',
        },
      },
    });
  }

  function handleEditGraphQLSettings(
    schema: string,
    name: string,
    objectType?: DatabaseObjectType,
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
          />
        ) : (
          <EditGraphQLSettingsForm schema={schema} tableName={name} />
        ),
      props: {
        PaperProps: {
          className: 'overflow-hidden ',
        },
      },
    });
  }

  async function handleCreateTableSubmit() {
    await Promise.all([
      queryClient.refetchQueries({
        queryKey: [EXPORT_METADATA_QUERY_KEY, project?.subdomain],
      }),
      refetchDatabaseQuery(),
    ]);
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
        />
      ),
    });
  }

  return {
    removableObject,
    optimisticlyRemovedObject,
    sidebarMenuObject,
    setSidebarMenuObject,
    handleDeleteDatabaseObject,
    handleEditPermission,
    handleEditGraphQLSettings,
    handleEditRelationships,
    openEditTableDrawer,
    openEditViewDrawer,
    openEditFunctionDrawer,
    openCreateTableDrawer,
  };
}

export default useDataBrowserActions;
