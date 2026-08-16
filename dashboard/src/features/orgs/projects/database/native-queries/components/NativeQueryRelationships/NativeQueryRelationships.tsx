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
import {
  RelationshipFormDialog,
  type RelationshipWithKind,
} from '@/features/orgs/projects/database/native-queries/components/RelationshipFormDialog';
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
} from '@/utils/hasura-api/generated/schemas';

interface NativeQueryRelationshipsProps {
  query: NativeQueryItem;
  queries: NativeQueryItem[];
  models: LogicalModelItem[];
  getQueryHref?: (queryName: string) => string;
}

export default function NativeQueryRelationships({
  query,
  queries,
  models,
  getQueryHref,
}: NativeQueryRelationshipsProps) {
  const mutation = useNativeQueryMetadataMutation({ type: 'edit' });
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

  const persist = async (
    updated: NativeQueryItem,
    messages: { loading: string; success: string; error: string },
  ) => {
    const result = await execPromiseWithErrorToast(
      () =>
        mutation.mutateAsync({
          original: query,
          args: {
            ...updated,
            source: 'default',
            type: updated.type ?? 'query',
            arguments: updated.arguments ?? {},
          },
        }),
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
                    {getQueryHref ? (
                      <NextLink
                        href={getQueryHref(
                          relationship.using.remote_native_query,
                        )}
                        className="text-primary hover:underline"
                      >
                        {relationship.using.remote_native_query}
                      </NextLink>
                    ) : (
                      <span>{relationship.using.remote_native_query}</span>
                    )}
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
        relationship={selected}
        onSubmit={async (values) => {
          const input: NativeQueryRelationshipInput = values;
          const updated = selected
            ? updateNativeQueryRelationship(
                query,
                selected.relationship.name,
                input,
              )
            : addNativeQueryRelationship(query, input);
          const saved = await persist(updated, {
            loading: selected
              ? 'Updating relationship...'
              : 'Creating relationship...',
            success: selected
              ? 'Relationship updated.'
              : 'Relationship created.',
            error: selected
              ? 'Could not update the relationship.'
              : 'Could not create the relationship.',
          });
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
                  removeNativeQueryRelationship(
                    query,
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
