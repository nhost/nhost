import { ChevronDown, MessageSquareText, Pencil, Shapes } from 'lucide-react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useDialog } from '@/components/common/DialogProvider';
import { InlineCode } from '@/components/presentational/InlineCode';
import { Button } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { Skeleton } from '@/components/ui/v3/skeleton';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { EditLogicalModelForm } from '@/features/orgs/projects/database/native-queries/components/LogicalModelForms';
import NativeQueriesEmptyState from '@/features/orgs/projects/database/native-queries/components/NativeQueriesEmptyState';
import useGetLogicalModels from '@/features/orgs/projects/database/native-queries/hooks/useGetLogicalModels';
import useGetNativeQueries from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import type { LogicalModelType } from '@/utils/hasura-api/generated/schemas';

export function formatLogicalModelType(type: LogicalModelType): string {
  if ('scalar' in type) {
    return `${type.scalar}${type.nullable ? ' | null' : ''}`;
  }

  if ('logical_model' in type) {
    return `${type.logical_model}${type.nullable ? ' | null' : ''}`;
  }

  const item = formatLogicalModelType(type.array);
  return `${item.includes(' | null') ? `(${item})` : item}[]${
    type.nullable ? ' | null' : ''
  }`;
}

export default function LogicalModelDetails() {
  const router = useRouter();
  const { modelSlug, orgSlug, appSubdomain, dataSourceSlug } = router.query;
  const { data: models = [], isLoading, error } = useGetLogicalModels();
  const {
    data: queries = [],
    isLoading: queriesLoading,
    error: queriesError,
  } = useGetNativeQueries();
  const { openDrawer } = useDialog();

  if (error instanceof Error) {
    throw error;
  }

  if (queriesError instanceof Error) {
    throw queriesError;
  }

  if (dataSourceSlug && dataSourceSlug !== 'default') {
    return (
      <NativeQueriesEmptyState
        title="Database not found"
        description={
          <span>
            Database <InlineCode>{dataSourceSlug}</InlineCode> does not exist.
          </span>
        }
      />
    );
  }

  if (isLoading || queriesLoading || !modelSlug) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-14 w-72" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const model = models.find((item) => item.name === modelSlug);

  if (!model) {
    return (
      <NativeQueriesEmptyState
        title="Logical model not found"
        description={
          <span>
            Logical model <InlineCode>{modelSlug}</InlineCode> does not exist.
          </span>
        }
      />
    );
  }

  const modelName = model.name;
  const description = model.description?.trim();
  const permissions = model.select_permissions ?? [];
  const usedBy = queries.filter((query) => query.returns === modelName);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b-1 px-6 pt-6 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
            <Shapes className="h-6 w-6 text-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="mb-1 font-semibold text-foreground text-xl">
              {model.name}
            </h1>
            <span className="text-muted-foreground text-sm">Logical model</span>
            {description != null && description.length > 0 && (
              <div className="mt-3 flex max-w-prose items-start gap-2 text-muted-foreground text-sm">
                <MessageSquareText className="mt-0.5 size-4 shrink-0" />
                <TextWithTooltip
                  text={description}
                  maxLines={3}
                  containerClassName="min-w-0 flex-1"
                  className="break-words"
                />
              </div>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              openDrawer({
                title: (
                  <span className="inline-grid grid-flow-col items-center gap-2">
                    Edit
                    <InlineCode className="!text-sm+ font-normal">
                      {model.name}
                    </InlineCode>
                    logical model
                  </span>
                ),
                component: <EditLogicalModelForm model={model} />,
              })
            }
          >
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Edit
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-auto p-6">
        <Collapsible defaultOpen className="rounded border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-medium text-foreground">
            Fields
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
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
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen className="rounded border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-medium text-foreground">
            Select permissions
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
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
          </CollapsibleContent>
        </Collapsible>

        <Collapsible defaultOpen className="rounded border">
          <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left font-medium text-foreground">
            Used by
            <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
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
                      href={`/orgs/${orgSlug}/projects/${appSubdomain}/database/native-queries/${dataSourceSlug}/queries/${query.root_field_name}`}
                      className="text-primary hover:underline"
                    >
                      {query.root_field_name}
                    </NextLink>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
