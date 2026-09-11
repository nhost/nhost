import { Pencil, Plus, Trash2 } from 'lucide-react';
import NextLink from 'next/link';
import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { RelationshipFormDialog } from '@/features/orgs/projects/database/native-queries/components/RelationshipFormDialog';
import { useGetNativeQueries } from '@/features/orgs/projects/database/native-queries/hooks/useGetNativeQueries';
import { useNativeQueryMetadataMutation } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import {
  addNativeQueryRelationship,
  type NativeQueryRelationshipInput,
  removeNativeQueryRelationship,
  updateNativeQueryRelationship,
} from '@/features/orgs/projects/database/native-queries/utils/nativeQueryRelationships';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  LogicalModelItem,
  NativeQueryItem,
  NativeQueryRelationship,
  NativeQueryRelationshipUsingNativeQuery,
  NativeQueryRelationshipUsingTable,
} from '@/utils/hasura-api/generated/schemas';

export interface NativeQueryRelationshipsProps {
  query: NativeQueryItem;
  queries: NativeQueryItem[];
  models: LogicalModelItem[];
  source: string;
  getQueryHref?: (queryName: string) => string;
}

interface RelationshipWithKind {
  relationship: NativeQueryRelationship;
  kind: 'object' | 'array';
}

interface EditableRelationshipWithKind extends RelationshipWithKind {
  relationship: NativeQueryRelationship & {
    using: NativeQueryRelationshipUsingNativeQuery;
  };
}

interface RelationshipTargetProps {
  relationship: NativeQueryRelationship;
  getQueryHref?: (queryName: string) => string;
}

const isNativeQueryTargetRelationship = (
  relationship: NativeQueryRelationship,
): relationship is NativeQueryRelationship & {
  using: NativeQueryRelationshipUsingNativeQuery;
} => 'remote_native_query' in relationship.using;

const formatRemoteTable = (
  remoteTable: NativeQueryRelationshipUsingTable['remote_table'],
): string =>
  typeof remoteTable === 'string'
    ? remoteTable
    : `${remoteTable.schema}.${remoteTable.name}`;

const getRelationshipTargetName = (
  relationship: NativeQueryRelationship,
): string => {
  if ('remote_native_query' in relationship.using) {
    return relationship.using.remote_native_query;
  }
  return formatRemoteTable(relationship.using.remote_table);
};

const getEditableRelationship = (
  selected: RelationshipWithKind | undefined,
): EditableRelationshipWithKind | undefined => {
  if (!selected || !isNativeQueryTargetRelationship(selected.relationship)) {
    return undefined;
  }
  return { ...selected, relationship: selected.relationship };
};

function RelationshipTarget({
  relationship,
  getQueryHref,
}: RelationshipTargetProps) {
  const targetName = getRelationshipTargetName(relationship);
  if (isNativeQueryTargetRelationship(relationship) && getQueryHref) {
    return (
      <NextLink
        href={getQueryHref(targetName)}
        className="text-primary hover:underline"
      >
        {targetName}
      </NextLink>
    );
  }
  return <span>{targetName}</span>;
}

export default function NativeQueryRelationships({
  query,
  source,
  queries,
  models,
  getQueryHref,
}: NativeQueryRelationshipsProps) {
  const mutation = useNativeQueryMetadataMutation({ type: 'edit' });
  const { refetch: refetchNativeQueries } = useGetNativeQueries(source);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selected, setSelected] = useState<RelationshipWithKind | undefined>();
  const relationships: RelationshipWithKind[] = [
    ...(query.object_relationships ?? []).map((relationship) => ({
      relationship,
      kind: 'object' as const,
    })),
    ...(query.array_relationships ?? []).map((relationship) => ({
      relationship,
      kind: 'array' as const,
    })),
  ];
  const editableRelationship = getEditableRelationship(selected);

  // Relationship writes replace the whole native query, so the transform must
  // run against the current metadata instead of the render-time snapshot.
  const persist = async (
    transform: (current: NativeQueryItem) => NativeQueryItem,
    messages: { loading: string; success: string; error: string },
  ) => {
    const result = await execPromiseWithErrorToast(
      async () => {
        const { data: latestQueries, error } = await refetchNativeQueries();
        if (error) {
          throw error;
        }
        const current = latestQueries?.find(
          (item) => item.root_field_name === query.root_field_name,
        );
        if (!current) {
          throw new Error(
            'This native query changed since the page loaded. Reload and try again.',
          );
        }
        const updated = transform(current);
        return mutation.mutateAsync({
          source,
          original: current,
          args: {
            ...updated,
            type: updated.type ?? 'query',
            arguments: updated.arguments ?? {},
          },
        });
      },
      {
        loadingMessage: messages.loading,
        successMessage: messages.success,
        errorMessage: messages.error,
      },
    );
    return Boolean(result);
  };

  return (
    <>
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-foreground text-sm+">
              Relationships
            </h2>
            <p className="mt-1 text-muted-foreground text-sm">
              {query.object_relationships?.length ?? 0} object ·{' '}
              {query.array_relationships?.length ?? 0} array
            </p>
          </div>
          <Button
            type="button"
            className="flex w-fit items-center gap-2"
            onClick={() => {
              setSelected(undefined);
              setFormOpen(true);
            }}
          >
            Relationship
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {relationships.length === 0 ? (
          <p className="rounded-md bg-muted p-4 text-muted-foreground text-sm">
            No relationships defined.
          </p>
        ) : (
          <div className="divide-y rounded-md border">
            {relationships.map(({ relationship, kind }) => (
              <div
                key={`${kind}-${relationship.name}`}
                className="flex items-center justify-between gap-3 p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground text-sm">
                    {relationship.name}
                  </p>
                  <div className="flex flex-wrap items-center gap-1 text-muted-foreground text-xs">
                    <span className="capitalize">{kind}</span>
                    <span>→</span>
                    <RelationshipTarget
                      relationship={relationship}
                      getQueryHref={getQueryHref}
                    />
                    <span>
                      · {Object.keys(relationship.using.column_mapping).length}{' '}
                      mapping(s)
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit relationship ${relationship.name}`}
                        disabled={
                          !isNativeQueryTargetRelationship(relationship)
                        }
                        onClick={() => {
                          setSelected({ relationship, kind });
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete relationship ${relationship.name}`}
                        onClick={() => {
                          setSelected({ relationship, kind });
                          setDeleteOpen(true);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <RelationshipFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        query={query}
        queries={queries}
        models={models}
        relationship={editableRelationship}
        onSubmit={async (values) => {
          const input: NativeQueryRelationshipInput = values;
          const saved = await persist(
            (current) =>
              editableRelationship
                ? updateNativeQueryRelationship(
                    current,
                    editableRelationship.relationship.name,
                    input,
                  )
                : addNativeQueryRelationship(current, input),
            {
              loading: editableRelationship
                ? 'Updating relationship...'
                : 'Creating relationship...',
              success: editableRelationship
                ? 'Relationship updated.'
                : 'Relationship created.',
              error: editableRelationship
                ? 'Could not update the relationship.'
                : 'Could not create the relationship.',
            },
          );
          if (saved) {
            setFormOpen(false);
          }
        }}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent
          className="text-foreground"
          onEscapeKeyDown={(event) => event.stopPropagation()}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>Delete relationship?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <strong>{selected?.relationship.name}</strong> from
              the native query.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={mutation.isPending || !selected}
              onClick={async (event) => {
                event.preventDefault();
                if (!selected) {
                  return;
                }
                const saved = await persist(
                  (current) =>
                    removeNativeQueryRelationship(
                      current,
                      selected.relationship.name,
                    ),
                  {
                    loading: 'Deleting relationship...',
                    success: 'Relationship deleted.',
                    error: 'Could not delete the relationship.',
                  },
                );
                if (saved) {
                  setDeleteOpen(false);
                }
              }}
            >
              Delete relationship
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
