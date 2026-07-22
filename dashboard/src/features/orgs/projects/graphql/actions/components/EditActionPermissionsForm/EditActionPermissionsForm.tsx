import NavLink from 'next/link';
import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { PermissionsLegend } from '@/features/orgs/projects/common/components/PermissionsLegend';
import {
  type RolePermissionRow,
  RolePermissionsGrid,
} from '@/features/orgs/projects/common/components/RolePermissionsGrid';
import { useGetActions } from '@/features/orgs/projects/graphql/actions/hooks/useGetActions';
import { useManageActionPermissionMutation } from '@/features/orgs/projects/graphql/actions/hooks/useManageActionPermissionMutation';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useGetRemoteAppRolesQuery } from '@/utils/__generated__/graphql';

export interface EditActionPermissionsFormProps {
  /**
   * Name of the action whose permissions are being edited.
   */
  actionName: string;
  /**
   * Function to be called when the form is cancelled.
   */
  onCancel?: VoidFunction;
}

export default function EditActionPermissionsForm({
  actionName,
  onCancel,
}: EditActionPermissionsFormProps) {
  const { project } = useProject();
  const { org } = useCurrentOrg();

  const client = useRemoteApplicationGQLClient();
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({ client });

  const {
    data: actionsData,
    isLoading: actionsLoading,
    error: actionsError,
  } = useGetActions();

  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  const { mutateAsync: manageActionPermission, isPending: isMutating } =
    useManageActionPermissionMutation();

  if (rolesLoading || actionsLoading) {
    return (
      <div className="box flex h-full items-center justify-center p-6">
        <Spinner>Loading permissions...</Spinner>
      </div>
    );
  }

  if (rolesError) {
    throw rolesError;
  }

  if (actionsError) {
    throw actionsError;
  }

  const action = actionsData?.actions.find((item) => item.name === actionName);

  const availableRoles = Array.from(
    new Set([
      'public',
      ...(rolesData?.authRoles?.map(({ role }) => role) ?? []),
    ]),
  ).filter((role) => role !== 'admin');

  const permittedRoles = new Set(
    action?.permissions?.map((permission) => permission.role),
  );

  const rows: RolePermissionRow[] = [
    {
      role: 'admin',
      access: 'allowed',
      hasPermission: true,
      interactive: false,
    },
    ...availableRoles.map((role): RolePermissionRow => {
      const hasPermission = permittedRoles.has(role);
      return {
        role,
        access: hasPermission ? 'allowed' : 'not-allowed',
        hasPermission,
        confirmDescription: (
          <>
            This action is{' '}
            <strong>{hasPermission ? 'allowed' : 'not allowed'}</strong> for
            role: <strong>{role}</strong>
          </>
        ),
      };
    }),
  ];

  const handleTogglePermission = async (
    role: string,
    nextHasPermission: boolean,
  ) => {
    await execPromiseWithErrorToast(
      async () => {
        await manageActionPermission({
          action: actionName,
          role,
          type: nextHasPermission
            ? 'create_action_permission'
            : 'drop_action_permission',
        });
        setExpandedRole(null);
      },
      {
        loadingMessage: `${nextHasPermission ? 'Granting' : 'Removing'} permission...`,
        successMessage: nextHasPermission
          ? `Permission for role "${role}" has been granted.`
          : `Permission for role "${role}" has been removed.`,
        errorMessage: 'An error occurred while updating the permission.',
      },
    );
  };

  return (
    <div className="box flex flex-auto flex-col content-between overflow-hidden border-t bg-background">
      <div className="flex-auto overflow-hidden">
        <div className="box grid h-full grid-flow-row content-start gap-6 overflow-y-auto border-b p-6">
          <div className="grid grid-flow-row gap-2">
            <h2 className="font-bold">Roles &amp; Permissions overview</h2>
            <p className="text-muted-foreground text-sm">
              Click on a permission cell to toggle which roles are allowed to
              call this action.
            </p>
          </div>

          <PermissionsLegend hidePartialAccess />

          <RolePermissionsGrid
            rows={rows}
            expandedRole={expandedRole}
            onExpandedRoleChange={setExpandedRole}
            onToggle={handleTogglePermission}
            isMutating={isMutating}
          />

          <Alert className="border-none bg-primary/10 text-left">
            <AlertDescription className="text-sm+">
              <p>
                Go to the{' '}
                <NavLink
                  href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/roles-and-permissions`}
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Settings page
                </NavLink>{' '}
                to add and delete roles.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      </div>

      <div className="box grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t p-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
