import { useDialog } from '@/components/common/DialogProvider';
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
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import type { DialogFormProps } from '@/types/common';
import NavLink from 'next/link';
import { twMerge } from 'tailwind-merge';
import RolePermissionsRow from './RolePermissionsRow';

export interface EditPermissionsFormProps extends DialogFormProps {
  /**
   * The schema name of the remote schema that is being edited.
   */
  schema: string;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

export default function EditPermissionsForm({
  schema,
  onCancel,
}: EditPermissionsFormProps) {
  const { closeDrawerWithDirtyGuard } = useDialog();
  const { project } = useProject();
  const { org } = useCurrentOrg();

  // Mock roles for presentational purposes
  const mockRoles = ['public', 'user', 'moderator'];

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
              role and action can be set by clicking on the corresponding cell.
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
                <RolePermissionsRow
                  name="admin"
                  disabled
                  accessLevels={{
                    insert: 'full',
                    select: 'none',
                    update: 'none',
                    delete: 'none',
                  }}
                />

                {mockRoles.map((currentRole, index) => (
                  <RolePermissionsRow
                    name={currentRole}
                    key={currentRole}
                    className={twMerge(
                      index === mockRoles.length - 1 && 'border-b-0',
                    )}
                    onActionSelect={() => {
                      // TODO: Add functionality when needed
                    }}
                    accessLevels={{
                      insert: 'none',
                      select: 'none',
                      update: 'none',
                      delete: 'none',
                    }}
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
