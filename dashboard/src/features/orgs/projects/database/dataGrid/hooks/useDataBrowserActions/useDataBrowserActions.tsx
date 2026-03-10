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
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';

const permissionTypeLabels: Record<DatabaseObjectType, string> = {
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

const FunctionDefinitionView = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/FunctionDefinitionView/FunctionDefinitionView'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditFunctionSettingsForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditFunctionSettingsForm/EditFunctionSettingsForm'
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
      '@/features/orgs/projects/database/dataGrid/components/EditGraphQLSettingsForm'
    ).then((mod) => mod.EditGraphQLSettingsForm),
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
  functionSlug: string | undefined;
  selectedSchema: string;
  refetchDatabaseQuery: () => Promise<unknown>;
  allObjects: DatabaseObjectViewModel[];
  functions: Array<{ function_schema: string; function_name: string }>;
}

export function useDataBrowserActions({
  dataSourceSlug,
  schemaSlug,
  tableSlug,
  functionSlug,
  selectedSchema,
  refetchDatabaseQuery,
  allObjects,
  functions,
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
    table: string,
    type: TableLikeObjectType,
  ) {
    const objectPath = `${schema}.${table}`;

    setRemovableObject(objectPath);

    try {
      let nextObjectIndex: number | null = null;

      if (isNotEmptyValue(allObjects) && allObjects.length > 1) {
        const currentObjectIndex = allObjects.findIndex(
          (obj) => `${obj.schema}.${obj.name}` === objectPath,
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

      await deleteDatabaseObject({ schema, table, type });
      queryClient.removeQueries({
        queryKey: [`${dataSourceSlug}.${schema}.${table}`],
      });

      setOptimisticlyRemovedObject(objectPath);
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

      if (schema === schemaSlug && table === tableSlug) {
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}/${nextObject.schema}/tables/${nextObject.name}`,
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
    objectType: TableLikeObjectType,
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
          handleDeleteDatabaseObjectConfirmation(schema, name, objectType),
      },
    });
  }

  async function handleDeleteFunctionConfirmation(
    schema: string,
    functionName: string,
  ) {
    const functionPath = `${schema}.${functionName}`;

    setRemovableObject(functionPath);

    try {
      let nextFunctionIndex: number | null = null;

      if (isNotEmptyValue(functions) && functions.length > 1) {
        const currentFunctionIndex = functions.findIndex(
          ({ function_schema: fnSchema, function_name: fnName }) =>
            `${fnSchema}.${fnName}` === functionPath,
        );

        nextFunctionIndex = currentFunctionIndex + 1;

        if (currentFunctionIndex + 1 === functions.length) {
          nextFunctionIndex = currentFunctionIndex - 1;
        }
      }

      const nextFunction =
        isNotEmptyValue(nextFunctionIndex) && isNotEmptyValue(functions)
          ? functions[nextFunctionIndex]
          : null;

      await deleteDatabaseObject({
        schema,
        table: functionName,
        type: 'FUNCTION',
      });

      queryClient.removeQueries({
        queryKey: [
          'function-definition',
          `${dataSourceSlug}.${schema}.${functionName}`,
        ],
      });

      setOptimisticlyRemovedObject(functionPath);
      await refetchDatabaseQuery();

      if (!nextFunction) {
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}`,
        );

        return;
      }

      if (schema === schemaSlug && functionName === functionSlug) {
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}/${nextFunction.function_schema}/functions/${nextFunction.function_name}`,
        );
      }
    } catch {
      // TODO: Introduce logging
    } finally {
      setRemovableObject(undefined);
      setOptimisticlyRemovedObject(undefined);
    }
  }

  function handleDeleteFunction(schema: string, functionName: string) {
    openAlertDialog({
      title: 'Delete Function',
      payload: (
        <span>
          Are you sure you want to delete the{' '}
          <strong className="break-all">{functionName}</strong> function?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: () =>
          handleDeleteFunctionConfirmation(schema, functionName),
      },
    });
  }

  function handleEditPermission(
    schema: string,
    table: string,
    disabled?: boolean,
    objectType?: DatabaseObjectType,
    updatability?: number,
  ) {
    const typeLabel = objectType ? permissionTypeLabels[objectType] : 'Table';

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
          disabled={disabled}
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
    table: string,
    disabled?: boolean,
  ) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          {disabled ? 'View GraphQL settings for' : 'Edit GraphQL settings for'}
          <InlineCode className="!text-sm+ font-normal">{table}</InlineCode>
          table
        </span>
      ),
      component: (
        <EditGraphQLSettingsForm
          disabled={disabled}
          schema={schema}
          tableName={table}
        />
      ),
      props: {
        PaperProps: {
          className: 'overflow-hidden ',
        },
      },
    });
  }

  function handleEditFunctionSettings(
    schema: string,
    functionName: string,
    disabled?: boolean,
  ) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          {disabled ? 'View settings for' : 'Edit settings for'}
          <InlineCode className="!text-sm+ font-normal">
            {functionName}
          </InlineCode>
          function
        </span>
      ),
      component: (
        <EditFunctionSettingsForm
          disabled={disabled}
          schema={schema}
          functionName={functionName}
        />
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
    tableName: string,
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
          table={tableName}
          dataSource={dataSourceSlug}
        />
      ),
    });
  }

  function openEditFunctionDrawer(schema: string, functionName: string) {
    openDrawer({
      title: 'Function Definition',
      component: (
        <FunctionDefinitionView
          schema={schema}
          functionName={functionName}
          dataSource={dataSourceSlug}
        />
      ),
    });
  }

  function handleEditRelationships(
    schema: string,
    table: string,
    disabled?: boolean,
  ) {
    openDrawer({
      title: `${disabled ? 'View' : 'Edit'} Relationships`,
      component: (
        <EditRelationshipsForm
          schema={schema}
          table={table}
          disabled={disabled}
        />
      ),
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
    handleDeleteFunction,
    handleEditPermission,
    handleEditGraphQLSettings,
    handleEditFunctionSettings,
    handleEditRelationships,
    openEditTableDrawer,
    openEditViewDrawer,
    openEditFunctionDrawer,
    openCreateTableDrawer,
  };
}

export default useDataBrowserActions;
