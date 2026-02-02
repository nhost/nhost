import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { Badge } from '@/components/ui/v3/badge';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { useDeleteFunctionWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteFunctionMutation';
import { useDeleteTableWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteTableMutation';
import { isNotEmptyValue } from '@/lib/utils';

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

const EditViewForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditViewForm/EditViewForm'
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

const EditFunctionPermissionsForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditFunctionPermissionsForm/EditFunctionPermissionsForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const EditTableSettingsForm = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/EditTableSettingsForm/EditTableSettingsForm'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

const TableInfoView = dynamic(
  () =>
    import(
      '@/features/orgs/projects/database/dataGrid/components/TableInfoView/TableInfoView'
    ),
  {
    ssr: false,
    loading: () => <FormActivityIndicator />,
  },
);

export interface DatabaseObject {
  table_schema: string;
  table_name: string;
  object_type: string;
}

export interface UseDataBrowserActionsParams {
  dataSourceSlug: string;
  schemaSlug: string | undefined;
  tableSlug: string | undefined;
  functionSlug: string | undefined;
  selectedSchema: string;
  refetch: () => Promise<unknown>;
  allObjects: DatabaseObject[];
  functions: Array<{ table_schema: string; table_name: string }>;
}

/**
 * Maps database object type to URL segment
 */
function getObjectTypeUrlSegment(
  objectType: string,
): 'tables' | 'views' | 'functions' {
  if (objectType === 'FUNCTION') {
    return 'functions';
  }
  return 'tables';
}

export function useDataBrowserActions({
  dataSourceSlug,
  schemaSlug,
  tableSlug,
  functionSlug,
  selectedSchema,
  refetch,
  allObjects,
  functions,
}: UseDataBrowserActionsParams) {
  const queryClient = useQueryClient();
  const { openDrawer, openAlertDialog } = useDialog();
  const router = useRouter();
  const {
    query: { orgSlug, appSubdomain },
  } = router;

  const { mutateAsync: deleteTable } = useDeleteTableWithToastMutation();
  const { mutateAsync: deleteFunction } = useDeleteFunctionWithToastMutation();

  const [removableTable, setRemovableTable] = useState<string>();
  const [optimisticlyRemovedTable, setOptimisticlyRemovedTable] =
    useState<string>();
  const [sidebarMenuTable, setSidebarMenuTable] = useState<string>();

  // Keep tablesInSelectedSchema for backward compatibility with delete logic
  const tablesInSelectedSchema = allObjects.filter(
    (obj) => obj.object_type !== 'MATERIALIZED VIEW',
  );

  async function handleDeleteTableConfirmation(
    schema: string,
    table: string,
    type: 'BASE TABLE' | 'VIEW' | 'MATERIALIZED VIEW',
  ) {
    const tablePath = `${schema}.${table}`;

    // We are greying out and disabling it in the sidebar
    setRemovableTable(tablePath);

    try {
      let nextTableIndex: number | null = null;

      if (
        isNotEmptyValue(tablesInSelectedSchema) &&
        tablesInSelectedSchema.length > 1
      ) {
        // We go to the next table if available or to the previous one if the
        // current one is the last one in the list
        const currentTableIndex = tablesInSelectedSchema.findIndex(
          ({ table_schema: tableSchema, table_name: tableName }) =>
            `${tableSchema}.${tableName}` === tablePath,
        );

        nextTableIndex = currentTableIndex + 1;

        if (currentTableIndex + 1 === tablesInSelectedSchema.length) {
          nextTableIndex = currentTableIndex - 1;
        }
      }

      const nextTable =
        isNotEmptyValue(nextTableIndex) &&
        isNotEmptyValue(tablesInSelectedSchema)
          ? tablesInSelectedSchema[nextTableIndex]
          : null;

      await deleteTable({
        schema,
        table,
        type,
      });
      queryClient.removeQueries({
        queryKey: [`${dataSourceSlug}.${schema}.${table}`],
      });

      // Note: At this point we can optimisticly assume that the table was
      // removed, so we can improve the UX by removing it from the list right
      // away, without waiting for the refetch to succeed.
      setOptimisticlyRemovedTable(tablePath);
      await refetch();

      // If this was the last table in the schema, we go back to the data
      // browser's main screen
      if (!nextTable) {
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}`,
        );

        return;
      }

      if (schema === schemaSlug && table === tableSlug) {
        const objectTypeSegment = getObjectTypeUrlSegment(
          nextTable.object_type,
        );
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}/${nextTable.table_schema}/${objectTypeSegment}/${nextTable.table_name}`,
        );
      }
    } catch {
      // TODO: Introduce logging
    } finally {
      setRemovableTable(undefined);
      setOptimisticlyRemovedTable(undefined);
    }
  }

  function handleDeleteTableClick(schema: string, table: string) {
    const tablePath = `${schema}.${table}`;
    const object = allObjects.find(
      ({ table_schema: tableSchema, table_name: tableName }) =>
        `${tableSchema}.${tableName}` === tablePath,
    );

    const objectLabel =
      object?.object_type === 'MATERIALIZED VIEW'
        ? 'materialized view'
        : object?.object_type === 'VIEW'
          ? 'view'
          : 'table';

    const title =
      objectLabel === 'materialized view'
        ? 'Delete Materialized View'
        : objectLabel === 'view'
          ? 'Delete View'
          : 'Delete Table';

    openAlertDialog({
      title,
      payload: (
        <span>
          Are you sure you want to delete the{' '}
          <strong className="break-all">{table}</strong> {objectLabel}?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: () =>
          handleDeleteTableConfirmation(
            schema,
            table,
            object?.object_type as 'BASE TABLE' | 'VIEW' | 'MATERIALIZED VIEW',
          ),
      },
    });
  }

  async function handleDeleteFunctionConfirmation(
    schema: string,
    functionName: string,
  ) {
    const functionPath = `${schema}.${functionName}`;

    // We are greying out and disabling it in the sidebar
    setRemovableTable(functionPath);

    try {
      let nextFunctionIndex: number | null = null;

      if (isNotEmptyValue(functions) && functions.length > 1) {
        // We go to the next function if available or to the previous one if the
        // current one is the last one in the list
        const currentFunctionIndex = functions.findIndex(
          ({ table_schema: functionSchema, table_name: fnName }) =>
            `${functionSchema}.${fnName}` === functionPath,
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

      // The hook fetches inputArgTypes internally, so we only need to pass schema and functionName
      // The mutation function signature requires inputArgTypes, but the hook handles fetching it internally
      // Type assertion needed because the hook's type signature doesn't reflect that it fetches inputArgTypes
      await deleteFunction({
        schema,
        functionName,
      } as { schema: string; functionName: string; inputArgTypes: never });

      queryClient.removeQueries({
        queryKey: [
          'function-definition',
          `${dataSourceSlug}.${schema}.${functionName}`,
        ],
      });

      // Note: At this point we can optimisticly assume that the function was
      // removed, so we can improve the UX by removing it from the list right
      // away, without waiting for the refetch to succeed.
      setOptimisticlyRemovedTable(functionPath);
      await refetch();

      // If this was the last function in the schema, we go back to the data
      // browser's main screen
      if (!nextFunction) {
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}`,
        );

        return;
      }

      if (schema === schemaSlug && functionName === functionSlug) {
        await router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/database/browser/${dataSourceSlug}/${nextFunction.table_schema}/functions/${nextFunction.table_name}`,
        );
      }
    } catch {
      // TODO: Introduce logging
    } finally {
      setRemovableTable(undefined);
      setOptimisticlyRemovedTable(undefined);
    }
  }

  function handleDeleteFunctionClick(schema: string, functionName: string) {
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

  function handleEditPermissionClick(
    schema: string,
    table: string,
    disabled?: boolean,
  ) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Permissions
          <InlineCode className="!text-sm+ font-normal">{table}</InlineCode>
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
        />
      ),
      props: {
        PaperProps: {
          className: 'lg:w-[65%] lg:max-w-7xl',
        },
      },
    });
  }

  function handleEditFunctionPermissionClick(
    schema: string,
    functionName: string,
    disabled?: boolean,
  ) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Permissions
          <InlineCode className="!text-sm+ font-normal">
            {functionName}
          </InlineCode>
        </span>
      ),
      component: (
        <EditFunctionPermissionsForm
          disabled={disabled}
          schema={schema}
          functionName={functionName}
        />
      ),
      props: {
        PaperProps: {
          className: 'lg:w-[65%] lg:max-w-7xl',
        },
      },
    });
  }

  function handleEditSettingsClick(
    schema: string,
    table: string,
    disabled?: boolean,
    objectType?: string,
  ) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          {disabled ? 'View settings for' : 'Edit settings for'}
          <InlineCode className="!text-sm+ font-normal">{table}</InlineCode>
          table
        </span>
      ),
      component: (
        <EditTableSettingsForm
          disabled={disabled}
          schema={schema}
          tableName={table}
          objectType={objectType}
        />
      ),
      props: {
        PaperProps: {
          className: 'overflow-hidden ',
        },
      },
    });
  }

  function handleEditFunctionSettingsClick(
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

  function openEditTableDrawer(schema: string, tableName: string) {
    const tableObject = allObjects.find(
      (obj) => obj.table_schema === schema && obj.table_name === tableName,
    );

    openDrawer({
      title: 'Edit Table',
      component: (
        <EditTableForm
          onSubmit={async (name) => {
            await queryClient.refetchQueries({
              queryKey: [`${dataSourceSlug}.${schema}.${name}`],
            });
            await refetch();
          }}
          schema={schema}
          table={tableObject || { table_schema: schema, table_name: tableName }}
        />
      ),
    });
  }

  function openEditViewDrawer(schema: string, table: DatabaseObject) {
    const isMaterializedView = table.object_type === 'MATERIALIZED VIEW';
    openDrawer({
      title: isMaterializedView ? 'Edit Materialized View' : 'Edit View',
      component: (
        <EditViewForm
          onSubmit={async (tableName) => {
            await queryClient.refetchQueries({
              queryKey: [`${dataSourceSlug}.${schema}.${tableName}`],
            });
            await refetch();
          }}
          schema={schema}
          table={table}
        />
      ),
    });
  }

  function openEditFunctionDrawer(schema: string, functionName: string) {
    openDrawer({
      title: 'Edit Function',
      component: (
        <EditFunctionForm
          onSubmit={async (fnName) => {
            await queryClient.refetchQueries([
              `${dataSourceSlug}.${schema}.${fnName}`,
            ]);
            await refetch();
          }}
          schema={schema}
          functionName={functionName}
        />
      ),
    });
  }

  function openCreateTableDrawer() {
    openDrawer({
      title: 'Create a New Table',
      component: <CreateTableForm onSubmit={refetch} schema={selectedSchema} />,
    });
  }

  function handleViewTableInfoClick(schema: string, table: string) {
    openDrawer({
      title: (
        <span className="inline-grid grid-flow-col items-center gap-2">
          Table Info
          <InlineCode className="!text-sm+ font-normal">{table}</InlineCode>
        </span>
      ),
      component: <TableInfoView schema={schema} table={table} />,
      props: {
        PaperProps: {
          className: 'lg:w-[50%] lg:max-w-3xl',
        },
      },
    });
  }

  return {
    // State
    removableTable,
    optimisticlyRemovedTable,
    sidebarMenuTable,
    setSidebarMenuTable,

    // Delete actions
    handleDeleteTableClick,
    handleDeleteFunctionClick,

    // Permission actions
    handleEditPermissionClick,
    handleEditFunctionPermissionClick,

    // Settings actions
    handleEditSettingsClick,
    handleEditFunctionSettingsClick,

    // Drawer openers
    openEditTableDrawer,
    openEditViewDrawer,
    openEditFunctionDrawer,
    openCreateTableDrawer,

    // Info actions
    handleViewTableInfoClick,
  };
}

export default useDataBrowserActions;
