import type { useDataBrowserActions } from '@/features/orgs/projects/database/dataGrid/hooks/useDataBrowserActions';
import type {
  DatabaseObjectViewModel,
  TableLikeObjectType,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import FunctionActions from './FunctionActions';
import TableActions from './TableActions';
import ViewActions from './ViewActions';

interface DatabaseObjectActionsProps {
  databaseObject: DatabaseObjectViewModel;
  dataSourceSlug: string;
  open: boolean;
  disabled: boolean;
  className?: string;
  isSelectedNotSchemaLocked: boolean;
  onOpen: () => void;
  onClose: () => void;
  actions: Pick<
    ReturnType<typeof useDataBrowserActions>,
    | 'handleDeleteDatabaseObjectClick'
    | 'handleDeleteFunctionClick'
    | 'handleEditPermissionClick'
    | 'handleEditFunctionPermissionClick'
    | 'handleEditGraphQLSettingsClick'
    | 'handleEditFunctionSettingsClick'
    | 'handleRelationshipsClick'
    | 'openEditTableDrawer'
    | 'openEditViewDrawer'
    | 'openEditFunctionDrawer'
  >;
}

export default function DatabaseObjectActions({
  databaseObject,
  dataSourceSlug,
  actions,
  ...sharedProps
}: DatabaseObjectActionsProps) {
  const { schema, name, objectType } = databaseObject;

  if (objectType === 'FUNCTION') {
    return (
      <FunctionActions
        tableName={name}
        {...sharedProps}
        onViewPermissions={() =>
          actions.handleEditFunctionPermissionClick(schema, name, true)
        }
        onEditPermissions={() =>
          actions.handleEditFunctionPermissionClick(schema, name)
        }
        onEditFunction={() => actions.openEditFunctionDrawer(schema, name)}
        onViewGraphQLSettings={() =>
          actions.handleEditFunctionSettingsClick(schema, name, true)
        }
        onEditGraphQLSettings={() =>
          actions.handleEditFunctionSettingsClick(schema, name, false)
        }
        onDelete={() => actions.handleDeleteFunctionClick(schema, name)}
      />
    );
  }

  if (['VIEW', 'MATERIALIZED VIEW'].includes(objectType)) {
    return (
      <ViewActions
        tableName={name}
        schema={schema}
        dataSource={dataSourceSlug}
        {...sharedProps}
        onViewPermissions={() =>
          actions.handleEditPermissionClick(schema, name, true, objectType)
        }
        onEditPermissions={() =>
          actions.handleEditPermissionClick(schema, name, undefined, objectType)
        }
        onEditView={() =>
          actions.openEditViewDrawer(
            schema,
            name,
            objectType as TableLikeObjectType,
          )
        }
        onEditGraphQLSettings={() =>
          actions.handleEditGraphQLSettingsClick(schema, name, false)
        }
        onViewGraphQLSettings={() =>
          actions.handleEditGraphQLSettingsClick(schema, name, true)
        }
        onEditRelationships={() =>
          actions.handleRelationshipsClick(schema, name)
        }
        onViewRelationships={() =>
          actions.handleRelationshipsClick(schema, name, true)
        }
        onDelete={() =>
          actions.handleDeleteDatabaseObjectClick(
            schema,
            name,
            objectType as TableLikeObjectType,
          )
        }
      />
    );
  }

  return (
    <TableActions
      tableName={name}
      schema={schema}
      dataSource={dataSourceSlug}
      {...sharedProps}
      onViewPermissions={() =>
        actions.handleEditPermissionClick(schema, name, true, objectType)
      }
      onEditPermissions={() =>
        actions.handleEditPermissionClick(schema, name, undefined, objectType)
      }
      onEditTable={() => actions.openEditTableDrawer(schema, name)}
      onEditGraphQLSettings={() =>
        actions.handleEditGraphQLSettingsClick(schema, name, false)
      }
      onViewGraphQLSettings={() =>
        actions.handleEditGraphQLSettingsClick(schema, name, true)
      }
      onEditRelationships={() => actions.handleRelationshipsClick(schema, name)}
      onViewRelationships={() =>
        actions.handleRelationshipsClick(schema, name, true)
      }
      onDelete={() =>
        actions.handleDeleteDatabaseObjectClick(
          schema,
          name,
          objectType as TableLikeObjectType,
        )
      }
    />
  );
}
