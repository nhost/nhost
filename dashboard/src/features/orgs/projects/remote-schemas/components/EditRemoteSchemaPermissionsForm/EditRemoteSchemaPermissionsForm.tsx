import { useState } from 'react';

import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { FullPermissionIcon } from '@/components/ui/v2/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v2/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v2/icons/PartialPermissionIcon';
import { Link } from '@/components/ui/v2/Link';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableContainer } from '@/components/ui/v2/TableContainer';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetRemoteSchemasQuery } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemasQuery';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import type { RemoteSchemaAccessLevel } from '@/features/orgs/projects/remote-schemas/types';
import { buildSchemaFromRoleDefinition } from '@/features/orgs/projects/remote-schemas/utils/buildSchemaFromRoleDefinition';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import { findRemoteSchemaPermission } from '@/features/orgs/projects/remote-schemas/utils/findRemoteSchemaPermission';
import { getRemoteSchemaFields } from '@/features/orgs/projects/remote-schemas/utils/getRemoteSchemaFields';
import type { DialogFormProps } from '@/types/common';
import {
  useGetHasuraRemoteSchemaPermissionsEnabledQuery,
  useGetRemoteAppRolesQuery,
} from '@/utils/__generated__/graphql';
import NavLink from 'next/link';
import { twMerge } from 'tailwind-merge';
import RemoteSchemaRolePermissionsEditorForm from './RemoteSchemaRolePermissionsEditorForm';
import RolePermissionsRow from './RolePermissionsRow';

export interface EditRemoteSchemaPermissionsFormProps extends DialogFormProps {
  /**
   * The name of the remote schema to edit permissions for.
   */
  schema: string;
  /**
   * Function to be called when the form is cancelled.
   */
  onCancel: () => void;
}

export default function EditRemoteSchemaPermissionsForm({
  schema,
  onCancel,
  location,
}: EditRemoteSchemaPermissionsFormProps) {
  const [selectedRole, setSelectedRole] = useState<string>();
  const [isEditing, setIsEditing] = useState(false);

  const client = useRemoteApplicationGQLClient();
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({ client });

  const { closeDrawerWithDirtyGuard } = useDialog();
  const { project } = useProject();
  const { org } = useCurrentOrg();
  const isPlatform = useIsPlatform();

  const localMimirClient = useLocalMimirClient();

  // Get remote schemas data
  const { data: remoteSchemas, refetch: refetchRemoteSchemas } =
    useGetRemoteSchemasQuery(['remote-schemas']);

  const { data: remoteSchemaPermissionsEnabledData } =
    useGetHasuraRemoteSchemaPermissionsEnabledQuery({
      variables: { appId: project?.id },
      ...(!isPlatform ? { client: localMimirClient } : {}),
    });

  const remoteSchemaPermissionsEnabled = Boolean(
    remoteSchemaPermissionsEnabledData?.config?.hasura?.settings
      ?.enableRemoteSchemaPermissions,
  );

  // Get remote schema permissions from metadata
  const remoteSchema = remoteSchemas?.find((rs: any) => rs.name === schema);
  const remoteSchemaPermissions = remoteSchema?.permissions || [];

  // Get introspection data for permission level comparison
  const { data: introspectionData } = useIntrospectRemoteSchemaQuery(schema, {
    queryOptions: { enabled: !!schema },
  });

  if (!remoteSchemaPermissionsEnabled) {
    return (
      <Box className="p-4">
        <Alert className="grid w-full grid-flow-col place-content-between items-center gap-2">
          <Text className="grid grid-flow-row justify-items-start gap-0.5">
            <Text component="span">
              To configure permissions, enable remote schema permissions first
              in{' '}
              <Link
                href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/hasura`}
                underline="hover"
              >
                Hasura Settings
              </Link>
              .
            </Text>
          </Text>
        </Alert>
      </Box>
    );
  }

  if (rolesLoading || !introspectionData) {
    return (
      <div className="p-6">
        <ActivityIndicator label="Loading available roles..." />
      </div>
    );
  }

  if (rolesError) {
    throw rolesError;
  }

  const availableRoles = [
    'public',
    ...(rolesData?.authRoles?.map(({ role: authRole }) => authRole) || []),
  ];

  const graphqlSchema = convertIntrospectionToSchema(introspectionData);

  // Helper function to get permission access level for a role
  const getPermissionAccessLevel = (role: string): RemoteSchemaAccessLevel => {
    let permissionAccess: RemoteSchemaAccessLevel;
    if (role === 'admin') {
      permissionAccess = 'full';
    } else {
      const existingPerm = findRemoteSchemaPermission(
        remoteSchemaPermissions,
        role,
      );
      if (existingPerm) {
        const remoteFields = getRemoteSchemaFields(
          graphqlSchema,
          buildSchemaFromRoleDefinition(existingPerm?.definition.schema),
        );
        permissionAccess = 'full';

        if (
          remoteFields
            .filter(
              (field) =>
                !field.name.startsWith('enum') &&
                !field.name.startsWith('scalar'),
            )
            .some((field) =>
              field.children?.some((element) => element.checked === false),
            )
        ) {
          permissionAccess = 'partial';
        }
      } else {
        permissionAccess = 'none';
      }
    }
    return permissionAccess;
  };

  // If editing a specific role's permissions
  if (isEditing && selectedRole) {
    // Find the existing permission for this role
    const existingPermission = remoteSchemaPermissions.find(
      (p: any) => p.role === selectedRole,
    );

    return (
      <RemoteSchemaRolePermissionsEditorForm
        location={location}
        remoteSchemaName={schema}
        role={selectedRole}
        permission={existingPermission}
        onSubmit={async () => {
          // Refresh the remote schemas data to reflect permission changes
          await refetchRemoteSchemas();
          setIsEditing(false);
          setSelectedRole(undefined);
        }}
        onCancel={() => {
          setIsEditing(false);
          setSelectedRole(undefined);
        }}
      />
    );
  }

  // Role selection view
  return (
    <Box
      className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
      sx={{ backgroundColor: 'background.default' }}
    >
      <div className="flex-auto">
        <Box className="grid grid-flow-row content-start gap-6 overflow-y-auto border-b-1 p-6">
          <div className="grid grid-flow-row gap-2">
            <Text component="h2" className="!font-bold">
              Remote Schema: {schema}
            </Text>

            <Text>
              Configure permissions for remote schema access. Rules for each
              role can be set by clicking on the corresponding cell.
            </Text>
          </div>

          <div className="grid grid-flow-col items-center justify-start gap-4">
            <Text
              variant="subtitle2"
              className="grid grid-flow-col items-center gap-1"
            >
              full access <FullPermissionIcon />
            </Text>

            <Text
              variant="subtitle2"
              className="grid grid-flow-col items-center gap-1"
            >
              partial access <PartialPermissionIcon />
            </Text>

            <Text
              variant="subtitle2"
              className="grid grid-flow-col items-center gap-1"
            >
              no access <NoPermissionIcon />
            </Text>
          </div>

          <TableContainer sx={{ backgroundColor: 'background.paper' }}>
            <Table>
              <TableHead className="block">
                <TableRow className="grid grid-cols-2 items-center">
                  <TableCell className="border-b-0 p-2">Role</TableCell>

                  <TableCell className="border-b-0 p-2 text-center">
                    Permission
                  </TableCell>
                </TableRow>
              </TableHead>

              <TableBody className="block rounded-sm+ border-1">
                <RolePermissionsRow name="admin" disabled accessLevel="full" />

                {availableRoles.map((currentRole, index) => (
                  <RolePermissionsRow
                    name={currentRole}
                    key={currentRole}
                    className={twMerge(
                      index === availableRoles.length - 1 && 'border-b-0',
                    )}
                    onActionSelect={() => {
                      setSelectedRole(currentRole);
                      setIsEditing(true);
                    }}
                    accessLevel={getPermissionAccessLevel(currentRole)}
                  />
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          <Alert className="text-left">
            Please go to the{' '}
            <NavLink
              href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/roles-and-permissions`}
              passHref
              legacyBehavior
            >
              <Link
                href="settings/roles-and-permissions"
                underline="hover"
                onClick={closeDrawerWithDirtyGuard}
              >
                Settings page
              </Link>
            </NavLink>{' '}
            to add and delete roles.
          </Alert>
        </Box>
      </div>

      <Box className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 p-2">
        <Button variant="borderless" color="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </Box>
    </Box>
  );
}
