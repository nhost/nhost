import { Check, X } from 'lucide-react';
import NavLink from 'next/link';
import { useDialog } from '@/components/common/DialogProvider';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useFunctionCustomizationQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionCustomizationQuery';
import { useFunctionQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useFunctionQuery';
import { useMetadataQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useMetadataQuery';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  useGetHasuraSettingsQuery,
  useGetRemoteAppRolesQuery,
} from '@/utils/__generated__/graphql';

export interface EditFunctionPermissionsFormProps {
  /**
   * Determines whether the form is disabled or not.
   */
  disabled?: boolean;
  /**
   * The schema that the function is in.
   */
  schema: string;
  /**
   * The function name.
   */
  functionName: string;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
}

export default function EditFunctionPermissionsForm({
  disabled,
  schema,
  functionName,
  onCancel,
}: EditFunctionPermissionsFormProps) {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data: hasuraSettingsData, loading: hasuraSettingsLoading } =
    useGetHasuraSettingsQuery({
      variables: { appId: project?.id },
      ...(!isPlatform ? { client: localMimirClient } : {}),
      skip: !project?.id,
    });

  const inferFunctionPermissions =
    hasuraSettingsData?.config?.hasura.settings?.inferFunctionPermissions;

  const { data: functionConfig, isLoading: isLoadingFunctionConfig } =
    useFunctionCustomizationQuery({
      function: {
        name: functionName,
        schema,
      },
      dataSource: 'default',
    });

  const { data: functionData, isLoading: isLoadingFunctionData } =
    useFunctionQuery(
      [`function-definition`, `default.${schema}.${functionName}`],
      {
        functionName,
        schema,
        dataSource: 'default',
        queryOptions: {
          enabled: !!schema && !!functionName,
        },
      },
    );

  const client = useRemoteApplicationGQLClient();
  const {
    data: rolesData,
    loading: rolesLoading,
    error: rolesError,
  } = useGetRemoteAppRolesQuery({ client });

  const {
    data: metadata,
    status: metadataStatus,
    error: metadataError,
  } = useMetadataQuery([`default.metadata`]);

  const { org } = useCurrentOrg();
  const { closeDrawerWithDirtyGuard } = useDialog();

  // Get the referenced table from function configuration or return type
  // The function configuration may have a response.table property
  // biome-ignore lint/suspicious/noExplicitAny: Function configuration may have response property
  const responseTable = (functionConfig?.configuration as any)?.response?.table;
  const referencedTable =
    responseTable?.name ||
    functionData?.functionMetadata?.returnTypeName ||
    'the referenced table';

  if (
    hasuraSettingsLoading ||
    isLoadingFunctionConfig ||
    isLoadingFunctionData ||
    rolesLoading ||
    metadataStatus === 'loading'
  ) {
    return (
      <div className="box flex h-full items-center justify-center p-6">
        <Spinner>Loading function permissions...</Spinner>
      </div>
    );
  }

  if (rolesError) {
    throw rolesError;
  }

  if (metadataError) {
    throw metadataError;
  }

  const availableRoles = [
    'public',
    ...(rolesData?.authRoles?.map(({ role: authRole }) => authRole) || []),
  ];

  // Get function permissions from metadata
  // Functions are stored in the source's functions array
  // The metadata returned from useMetadataQuery is a HasuraMetadataSource which has functions
  // biome-ignore lint/suspicious/noExplicitAny: Metadata structure may have functions property
  const functions = (metadata as any)?.functions || [];
  const functionMetadata = functions.find(
    // biome-ignore lint/suspicious/noExplicitAny: Function metadata structure
    (fn: any) =>
      fn.function?.name === functionName && fn.function?.schema === schema,
  );

  // Function permissions are stored as an array of objects with role property
  // biome-ignore lint/suspicious/noExplicitAny: Function permissions structure may vary
  const functionPermissions = (functionMetadata as any)?.permissions || [];

  const hasPermission = (role: string) => {
    return functionPermissions.some(
      // biome-ignore lint/suspicious/noExplicitAny: Function permission structure may vary
      (perm: any) => perm.role === role,
    );
  };

  const description = (
    <>
      Permissions will be inherited from the SELECT permissions of the
      referenced table ({referencedTable}) by default.
      {inferFunctionPermissions === false ? (
        <>
          <br />
          <br />
          The function will be exposed to the role if SELECT permissions are
          enabled and function permissions are enabled for the role.
        </>
      ) : (
        <>
          <br />
          <br />
          Function will be exposed automatically if there are SELECT permissions
          for the role. To expose query functions to roles explicitly, set{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
            HASURA_GRAPHQL_INFER_FUNCTION_PERMISSIONS=false
          </code>{' '}
          on the server.
        </>
      )}
    </>
  );

  return (
    <div className="box flex flex-auto flex-col content-between overflow-hidden border-t bg-background">
      <div className="flex-auto">
        <div className="box grid grid-flow-row content-start gap-6 overflow-y-auto border-b p-6">
          <div className="grid grid-flow-row gap-2">
            <h2 className="font-bold">Roles & Permissions overview</h2>

            <p>
              Click on a permission cell to toggle function permissions for a
              role.
            </p>
          </div>

          <div className="box grid grid-flow-row gap-4 border-b pb-4">
            <p className="text-sm">{description}</p>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Permission</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">admin</TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center">
                      <Check className="h-4 w-4" />
                    </div>
                  </TableCell>
                </TableRow>

                {availableRoles.map((currentRole) => {
                  const hasPerm = hasPermission(currentRole);

                  return (
                    <TableRow key={currentRole}>
                      <TableCell className="font-medium">
                        {currentRole}
                      </TableCell>
                      <TableCell className="text-center">
                        {disabled ? (
                          <div className="flex items-center justify-center">
                            {hasPerm ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="flex h-full w-full items-center justify-center hover:bg-muted/50"
                            onClick={() => {
                              // TODO: Implement permission toggle
                              // Toggle permission for role
                            }}
                          >
                            {hasPerm ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          <Alert>
            <AlertDescription className="space-y-2">
              <p>
                Please go to the{' '}
                <NavLink
                  href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/roles-and-permissions`}
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={closeDrawerWithDirtyGuard}
                >
                  Roles and Permissions
                </NavLink>{' '}
                page to add and delete roles.
              </p>
              <p>
                To configure infer function permissions, go to{' '}
                <NavLink
                  href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/hasura`}
                  className="text-primary underline-offset-4 hover:underline"
                  onClick={closeDrawerWithDirtyGuard}
                >
                  Hasura Settings
                </NavLink>
                .
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
