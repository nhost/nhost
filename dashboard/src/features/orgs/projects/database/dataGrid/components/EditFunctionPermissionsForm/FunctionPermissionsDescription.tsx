import NavLink from 'next/link';
import { useDialog } from '@/components/common/DialogProvider';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export interface FunctionPermissionsDescriptionProps {
  schema: string;
  dataSource: string;
  returnTableSchema: string | null;
  returnTableName: string | null;
  inferFunctionPermissions?: boolean | null;
  isMutationFunction?: boolean;
}

export function FunctionPermissionsDescription({
  schema,
  dataSource,
  returnTableSchema,
  returnTableName,
  inferFunctionPermissions,
  isMutationFunction,
}: FunctionPermissionsDescriptionProps) {
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const { closeDrawerWithDirtyGuard } = useDialog();

  const referencedTable = returnTableName || 'the referenced table';

  return (
    <>
      <p>
        Permissions will be inherited from the SELECT permissions of the
        referenced table (
        {returnTableName ? (
          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/database/browser/${dataSource}/${returnTableSchema || schema}/tables/${returnTableName}`}
            className="text-primary underline-offset-4 hover:underline"
            onClick={closeDrawerWithDirtyGuard}
          >
            {returnTableName}
          </NavLink>
        ) : (
          <span>{referencedTable}</span>
        )}
        ) by default.
      </p>
      {inferFunctionPermissions !== false && !isMutationFunction && (
        <p>
          Function will be exposed automatically if there are SELECT permissions
          for the role. To expose query functions to roles explicitly, set{' '}
          <InlineCode className="max-w-none">
            HASURA_GRAPHQL_INFER_FUNCTION_PERMISSIONS=false
          </InlineCode>{' '}
          in{' '}
          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/hasura`}
            className="text-primary underline-offset-4 hover:underline"
            onClick={closeDrawerWithDirtyGuard}
          >
            Hasura Settings
          </NavLink>
          .
        </p>
      )}
    </>
  );
}
