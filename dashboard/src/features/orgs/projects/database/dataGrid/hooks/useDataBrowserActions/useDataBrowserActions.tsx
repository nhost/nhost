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

  async function handleDeleteTableConfirmation(schema: string, table: string) {
    const tablePath = `${schema}.${table}`;

    // We are greying out and disabling it in the sidebar
    setRemovableTable(tablePath);

    try {
      let nextTableIndex: number | null = null;

      if (isNotEmptyValue(allObjects) && allObjects.length > 1) {
        // We go to the next table if available or to the previous one if the
        // current one is the last one in the list
        const currentTableIndex = allObjects.findIndex(
          ({ table_schema: tableSchema, table_name: tableName }) =>
            `${tableSchema}.${tableName}` === tablePath,
        );

        nextTableIndex = currentTableIndex + 1;

        if (currentTableIndex + 1 === allObjects.length) {
          nextTableIndex = currentTableIndex - 1;
        }
      }

      const nextTable =
        isNotEmptyValue(nextTableIndex) && isNotEmptyValue(allObjects)
          ? allObjects[nextTableIndex]
          : null;

      await deleteDatabaseObject({ schema, table, type: 'BASE TABLE' });
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
    openAlertDialog({
      title: 'Delete Table',
      payload: (
        <span>
          Are you sure you want to delete the{' '}
          <strong className="break-all">{table}</strong> table?
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: () => handleDeleteTableConfirmation(schema, table),
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
    removableTable,
    optimisticlyRemovedTable,
    sidebarMenuTable,
    setSidebarMenuTable,
    handleDeleteTableClick,
    handleEditPermissionClick,
    handleEditSettingsClick,
    handleRelationshipsClick,
    openEditTableDrawer,
    openCreateTableDrawer,
  };
}

export default useDataBrowserActions;
