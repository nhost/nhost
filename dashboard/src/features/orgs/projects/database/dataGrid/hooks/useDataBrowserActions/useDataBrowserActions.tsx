import { useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { FormActivityIndicator } from '@/components/form/FormActivityIndicator';
import { Badge } from '@/components/ui/v3/badge';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { useDeleteDatabaseObjectWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useDeleteDatabaseObjectMutation';
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

export interface DatabaseObject {
  table_schema: string;
  table_name: string;
  object_type: string;
}

export interface UseDataBrowserActionsParams {
  dataSourceSlug: string;
  schemaSlug: string | undefined;
  tableSlug: string | undefined;
  selectedSchema: string;
  refetch: () => Promise<unknown>;
  allObjects: DatabaseObject[];
}

/**
 * Maps database object type to URL segment
 */
function getObjectTypeUrlSegment(_objectType: string): 'tables' {
  return 'tables';
}

export function useDataBrowserActions({
  dataSourceSlug,
  schemaSlug,
  tableSlug,
  selectedSchema,
  refetch,
  allObjects,
}: UseDataBrowserActionsParams) {
  const queryClient = useQueryClient();
  const { openDrawer, openAlertDialog } = useDialog();
  const router = useRouter();
  const {
    query: { orgSlug, appSubdomain },
  } = router;

  const { mutateAsync: deleteDatabaseObject } =
    useDeleteDatabaseObjectWithToastMutation();

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

      await deleteDatabaseObject({ schema, table, type });
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
      title: isMaterializedView
        ? 'Materialized View Definition'
        : 'View Definition',
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

  function handleRelationshipsClick(
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
      component: <CreateTableForm onSubmit={refetch} schema={selectedSchema} />,
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

    // Permission actions
    handleEditPermissionClick,

    // Settings actions
    handleEditSettingsClick,

    // Relationships actions
    handleRelationshipsClick,

    // Drawer openers
    openEditTableDrawer,
    openEditViewDrawer,
    openCreateTableDrawer,
  };
}

export default useDataBrowserActions;
