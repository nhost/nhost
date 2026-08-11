import { useState } from 'react';
import { twMerge } from 'tailwind-merge';
import { NavLink } from '@/components/common/NavLink';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { FullPermissionIcon } from '@/components/ui/v3/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v3/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v3/icons/PartialPermissionIcon';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { TextLink } from '@/components/ui/v3/text-link';
import { InfoAlert } from '@/features/orgs/components/InfoAlert';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useGetRemoteSchemas } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas';
import { useIntrospectRemoteSchemaQuery } from '@/features/orgs/projects/remote-schemas/hooks/useIntrospectRemoteSchemaQuery';
import type { RemoteSchemaAccessLevel } from '@/features/orgs/projects/remote-schemas/types';
import buildRemoteSchemaFieldTree from '@/features/orgs/projects/remote-schemas/utils/buildRemoteSchemaFieldTree';
import convertIntrospectionToSchema from '@/features/orgs/projects/remote-schemas/utils/convertIntrospectionToSchema';
import { createPermissionsSchema } from '@/features/orgs/projects/remote-schemas/utils/createPermissionsSchema';
import { findRemoteSchemaPermission } from '@/features/orgs/projects/remote-schemas/utils/findRemoteSchemaPermission';
import {
  useGetHasuraRemoteSchemaPermissionsEnabledQuery,
  useGetRemoteAppRolesQuery,
} from '@/generated/graphql';
import type { DialogFormProps } from '@/types/common';
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
  onCancel?: () => void;
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

  const { project } = useProject();
  const { org } = useCurrentOrg();
  const isPlatform = useIsPlatform();

  const localMimirClient = useLocalMimirClient();

  const { data: remoteSchemas, refetch: refetchRemoteSchemas } =
    useGetRemoteSchemas();

  const {
    data: remoteSchemaPermissionsEnabledData,
    loading: remoteSchemaPermissionsEnabledLoading,
  } = useGetHasuraRemoteSchemaPermissionsEnabledQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const remoteSchemaPermissionsEnabled = Boolean(
    remoteSchemaPermissionsEnabledData?.config?.hasura?.settings
      ?.enableRemoteSchemaPermissions,
  );

  const remoteSchema = remoteSchemas?.find((rs) => rs.name === schema);
  const remoteSchemaPermissions = remoteSchema?.permissions || [];

  const {
    data: introspectionData,
    error: introspectionError,
    isLoading: introspectionLoading,
  } = useIntrospectRemoteSchemaQuery(schema, {
    queryOptions: { enabled: !!schema },
  });

  if (
    rolesLoading ||
    introspectionLoading ||
    remoteSchemaPermissionsEnabledLoading
  ) {
    return (
      <div className="p-6">
        <Spinner size="xs" wrapperClassName="flex-row gap-1.5">
          <span className="text-muted-foreground text-xs">
            Loading available roles...
          </span>
        </Spinner>
      </div>
    );
  }

  if (!remoteSchemaPermissionsEnabled) {
    return (
      <div className="p-4">
        <InfoAlert>
          To configure permissions, enable remote schema permissions first in{' '}
          <TextLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/hasura`}
          >
            Hasura Settings.
          </TextLink>
        </InfoAlert>
      </div>
    );
  }

  if (introspectionError instanceof Error) {
    throw new Error(introspectionError.message);
  }

  if (rolesError) {
    throw rolesError;
  }

  const availableRoles = [
    'public',
    ...(rolesData?.authRoles?.map(({ role: authRole }) => authRole) || []),
  ];

  const graphqlSchema = introspectionData
    ? convertIntrospectionToSchema(introspectionData)
    : undefined;

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
        if (!graphqlSchema) {
          permissionAccess = 'none';
        } else {
          const remoteFields = buildRemoteSchemaFieldTree(
            graphqlSchema,
            createPermissionsSchema(existingPerm?.definition.schema),
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
        }
      } else {
        permissionAccess = 'none';
      }
    }
    return permissionAccess;
  };

  if (isEditing && selectedRole) {
    const existingPermission = remoteSchemaPermissions.find(
      (p) => p.role === selectedRole,
    )!;

    return (
      <RemoteSchemaRolePermissionsEditorForm
        location={location}
        remoteSchemaName={schema}
        role={selectedRole}
        permission={existingPermission}
        onSubmit={async () => {
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

  return (
    <div className="box flex flex-auto flex-col content-between overflow-hidden border-t-1">
      <div className="flex-auto">
        <div className="box grid grid-flow-row content-start gap-6 overflow-y-auto border-b-1 p-6">
          <div className="grid grid-flow-row gap-2">
            <h2 className="!font-bold">Remote Schema: {schema}</h2>

            <p>
              Configure permissions for remote schema access. Rules for each
              role can be set by clicking on the corresponding cell.
            </p>
          </div>

          <div className="grid grid-flow-col items-center justify-start gap-4">
            <span className="grid grid-flow-col items-center gap-1 text-sm">
              full access <FullPermissionIcon />
            </span>

            <span className="grid grid-flow-col items-center gap-1 text-sm">
              partial access <PartialPermissionIcon />
            </span>

            <span className="grid grid-flow-col items-center gap-1 text-sm">
              no access <NoPermissionIcon />
            </span>
          </div>

          <Table containerClassName="bg-card">
            <TableHeader className="block">
              <TableRow className="grid grid-cols-2 items-center">
                <TableHead className="border-b-0 p-2">Role</TableHead>

                <TableHead className="border-b-0 p-2 text-center">
                  Permission
                </TableHead>
              </TableRow>
            </TableHeader>

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

          <Alert className="text-left">
            Please go to the{' '}
            <NavLink
              href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/roles-and-permissions`}
              underline="hover"
              className="px-0"
            >
              Settings page
            </NavLink>{' '}
            to add and delete roles.
          </Alert>
        </div>
      </div>

      <div className="box grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 p-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
