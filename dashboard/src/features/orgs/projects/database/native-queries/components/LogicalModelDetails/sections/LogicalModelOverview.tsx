import NextLink from 'next/link';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { NativeQueriesDetailsSection } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesDetailsSection';
import { formatLogicalModelType } from '@/features/orgs/projects/database/native-queries/utils/formatLogicalModelType';
import type {
  LogicalModelItem,
  NativeQueryItem,
} from '@/utils/hasura-api/generated/schemas';

export interface LogicalModelOverviewProps {
  model: LogicalModelItem;
  usedBy: NativeQueryItem[];
  buildQueryHref: (rootFieldName: string) => string;
}

export default function LogicalModelOverview({
  model,
  usedBy,
  buildQueryHref,
}: LogicalModelOverviewProps) {
  const permissions = model.select_permissions ?? [];

  return (
    <div className="flex-1 space-y-4 overflow-auto p-6">
      <NativeQueriesDetailsSection title="Fields">
        <div className="overflow-x-auto border-t">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {model.fields.map((field) => (
                <tr key={field.name} className="border-t first:border-t-0">
                  <td className="px-4 py-3 font-medium text-foreground">
                    {field.name}
                  </td>
                  <td className="px-4 py-3 font-mono text-foreground">
                    {formatLogicalModelType(field.type)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {field.description?.trim() || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </NativeQueriesDetailsSection>

      <NativeQueriesDetailsSection title="Select permissions">
        <div className="space-y-4 border-t p-4 text-sm">
          {permissions.length === 0 ? (
            <p className="text-muted-foreground">
              No roles have select permission.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {permissions.map(({ role }) => (
                <InlineCode key={role}>{role}</InlineCode>
              ))}
            </div>
          )}
        </div>
      </NativeQueriesDetailsSection>

      <NativeQueriesDetailsSection title="Used by">
        <div className="border-t p-4 text-sm">
          {usedBy.length === 0 ? (
            <p className="text-muted-foreground">
              No native queries return this logical model.
            </p>
          ) : (
            <div className="flex flex-col items-start gap-2">
              {usedBy.map((query) => (
                <NextLink
                  key={query.root_field_name}
                  href={buildQueryHref(query.root_field_name)}
                  className="text-primary hover:underline"
                >
                  {query.root_field_name}
                </NextLink>
              ))}
            </div>
          )}
        </div>
      </NativeQueriesDetailsSection>
    </div>
  );
}
