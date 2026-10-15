import { Link } from '@tanstack/react-router';
import { useDialog } from '@/components/common/DialogProvider';
import { InlineCode } from '@/components/ui/v3/inline-code';

export interface FunctionPermissionsDescriptionProps {
  schema: string;
  dataSource: string;
  returnTableSchema?: string | null;
  returnTableName?: string | null;
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
  const { closeDrawerWithDirtyGuard } = useDialog();

  const referencedTable = returnTableName || 'the referenced table';

  return (
    <>
      <p>
        Permissions will be inherited from the SELECT permissions of the
        referenced table (
        {returnTableName ? (
          <Link
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/database/browser/$dataSourceSlug/$schemaSlug/tables/$tableSlug"
            params={(prev) => ({
              ...prev,
              dataSourceSlug: dataSource,
              schemaSlug: returnTableSchema || schema,
              tableSlug: returnTableName,
            })}
            className="text-primary underline-offset-4 hover:underline"
            onClick={closeDrawerWithDirtyGuard}
          >
            {returnTableName}
          </Link>
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
          <Link
            from="/orgs/$orgSlug/projects/$appSubdomain"
            to="/orgs/$orgSlug/projects/$appSubdomain/graphql/settings"
            params
            search={{ tab: 'access-and-tooling' }}
            className="text-primary underline-offset-4 hover:underline"
            onClick={closeDrawerWithDirtyGuard}
          >
            GraphQL Settings
          </Link>
          .
        </p>
      )}
    </>
  );
}
