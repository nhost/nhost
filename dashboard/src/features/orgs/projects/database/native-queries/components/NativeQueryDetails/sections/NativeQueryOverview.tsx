import { PostgreSQL, sql } from '@codemirror/lang-sql';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import CodeMirror from '@uiw/react-codemirror';
import NextLink from 'next/link';
import { NativeQueriesDetailsSection } from '@/features/orgs/projects/database/native-queries/components/NativeQueriesDetailsSection';
import { useThemePreference } from '@/providers/Theme';
import type { NativeQueryItem } from '@/utils/hasura-api/generated/schemas';

export interface NativeQueryOverviewProps {
  query: NativeQueryItem;
  modelHref: string;
}

export default function NativeQueryOverview({
  query,
  modelHref,
}: NativeQueryOverviewProps) {
  const { resolvedTheme } = useThemePreference();
  const argumentsList = Object.entries(query.arguments ?? {});

  return (
    <div className="flex-1 space-y-4 overflow-auto p-6">
      <NativeQueriesDetailsSection title="SQL">
        <section className="border-t p-4" aria-label="Native query SQL">
          <CodeMirror
            value={query.code}
            minHeight="180px"
            className="overflow-hidden rounded-md border"
            theme={resolvedTheme === 'light' ? githubLight : githubDark}
            extensions={[sql({ dialect: PostgreSQL })]}
            editable={false}
            readOnly
          />
        </section>
      </NativeQueriesDetailsSection>

      <NativeQueriesDetailsSection title="Returns">
        <div className="border-t p-4 text-sm">
          <NextLink href={modelHref} className="text-primary hover:underline">
            {query.returns}
          </NextLink>
        </div>
      </NativeQueriesDetailsSection>

      <NativeQueriesDetailsSection title="Arguments">
        {argumentsList.length === 0 ? (
          <p className="border-t p-4 text-muted-foreground text-sm">
            This native query has no arguments.
          </p>
        ) : (
          <div className="overflow-x-auto border-t">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Nullable</th>
                  <th className="px-4 py-3 font-medium">Description</th>
                </tr>
              </thead>
              <tbody>
                {argumentsList.map(([name, argument]) => (
                  <tr key={name} className="border-t first:border-t-0">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {name}
                    </td>
                    <td className="px-4 py-3 font-mono text-foreground">
                      {argument.type}
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      {argument.nullable ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {argument.description?.trim() || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </NativeQueriesDetailsSection>
    </div>
  );
}
