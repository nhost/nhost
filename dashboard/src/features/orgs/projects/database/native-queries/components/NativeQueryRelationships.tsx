import { zodResolver } from '@hookform/resolvers/zod';
import { ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react';
import NextLink from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
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
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Input } from '@/components/ui/v3/input';
import { Label } from '@/components/ui/v3/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import useNativeQueryMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import buildNativeQueryTrackArgs from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';
import { nativeQueryToFormValues } from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
import {
  addNativeQueryRelationship,
  columnMappingToFieldMappings,
  hasNativeQueryRelationshipName,
  removeNativeQueryRelationship,
  updateNativeQueryRelationship,
  type NativeQueryRelationshipInput,
  type NativeQueryRelationshipKind,
} from '@/features/orgs/projects/database/native-queries/utils/nativeQueryRelationships';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  LogicalModelItem,
  NativeQueryItem,
  NativeQueryRelationship,
} from '@/utils/hasura-api/generated/schemas';

const relationshipSchema = z
  .object({
    name: z.string().trim().min(1, 'Relationship name is required.'),
    kind: z.enum(['object', 'array']),
    remoteNativeQuery: z.string().min(1, 'Select a target native query.'),
    fieldMappings: z
      .array(
        z.object({
          sourceField: z.string().min(1, 'Select a source field.'),
          targetField: z.string().min(1, 'Select a target field.'),
        }),
      )
      .min(1, 'Add at least one field mapping.'),
    insertionOrder: z.enum(['before_parent', 'after_parent']).nullable(),
  })
  .superRefine((values, context) => {
    const sourceFields = new Set<string>();
    values.fieldMappings.forEach((mapping, index) => {
      if (sourceFields.has(mapping.sourceField)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['fieldMappings', index, 'sourceField'],
          message: 'Source fields must be unique.',
        });
      }
      sourceFields.add(mapping.sourceField);
    });
  });

type RelationshipFormValues = z.infer<typeof relationshipSchema>;

interface RelationshipWithKind {
  relationship: NativeQueryRelationship;
  kind: NativeQueryRelationshipKind;
}

interface RelationshipFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  query: NativeQueryItem;
  queries: NativeQueryItem[];
  models: LogicalModelItem[];
  relationship?: RelationshipWithKind;
  isPending: boolean;
  onSubmit: (values: RelationshipFormValues) => Promise<void>;
}

const emptyValues: RelationshipFormValues = {
  name: '',
  kind: 'object',
  remoteNativeQuery: '',
  fieldMappings: [{ sourceField: '', targetField: '' }],
  insertionOrder: null,
};

export function RelationshipFormDialog({
  open,
  onOpenChange,
  query,
  queries,
  models,
  relationship,
  isPending,
  onSubmit,
}: RelationshipFormDialogProps) {
  const values = useMemo<RelationshipFormValues>(() => {
    if (!relationship) return emptyValues;
    return {
      name: relationship.relationship.name,
      kind: relationship.kind,
      remoteNativeQuery: relationship.relationship.using.remote_native_query,
      fieldMappings: columnMappingToFieldMappings(
        relationship.relationship.using.column_mapping,
      ),
      insertionOrder: relationship.relationship.using.insertion_order,
    };
  }, [relationship]);
  const form = useForm<RelationshipFormValues>({
    resolver: zodResolver(relationshipSchema),
    defaultValues: values,
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'fieldMappings',
  });
  const targetName = useWatch({
    control: form.control,
    name: 'remoteNativeQuery',
  });
  const sourceModel = models.find((model) => model.name === query.returns);
  const targetQuery = queries.find(
    (item) => item.root_field_name === targetName,
  );
  const targetModel = models.find(
    (model) => model.name === targetQuery?.returns,
  );
  const { reset } = form;

  useEffect(() => {
    if (open) reset(values);
  }, [open, reset, values]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto text-foreground">
        <DialogHeader>
          <DialogTitle>
            {relationship ? 'Edit relationship' : 'Create relationship'}
          </DialogTitle>
          <DialogDescription>
            Map fields from this query to fields returned by a target query.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-5"
          onSubmit={form.handleSubmit(async (nextValues) => {
            if (
              hasNativeQueryRelationshipName(
                query,
                nextValues.name,
                relationship?.relationship.name,
              )
            ) {
              form.setError('name', {
                message: 'A relationship with this name already exists.',
              });
              return;
            }
            await onSubmit(nextValues);
          })}
        >
          <div className="space-y-2">
            <Label htmlFor="relationship-name">Relationship name</Label>
            <Input id="relationship-name" {...form.register('name')} />
            {form.formState.errors.name && (
              <p className="text-destructive text-sm">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cardinality</Label>
              <Controller
                control={form.control}
                name="kind"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Cardinality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="object">Object</SelectItem>
                      <SelectItem value="array">Array</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label>Target native query</Label>
              <Controller
                control={form.control}
                name="remoteNativeQuery"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Target native query">
                      <SelectValue placeholder="Select a query" />
                    </SelectTrigger>
                    <SelectContent>
                      {queries.map((item) => (
                        <SelectItem
                          key={item.root_field_name}
                          value={item.root_field_name}
                        >
                          {item.root_field_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.remoteNativeQuery && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.remoteNativeQuery.message}
                </p>
              )}
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Field mappings</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ sourceField: '', targetField: '' })}
              >
                <Plus className="mr-2 h-4 w-4" /> Add mapping
              </Button>
            </div>
            {fields.map((mapping, index) => (
              <div
                key={mapping.id}
                className="grid gap-2 rounded-md bg-muted p-3 sm:grid-cols-[1fr_1fr_auto]"
              >
                <Controller
                  control={form.control}
                  name={`fieldMappings.${index}.sourceField`}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger aria-label={`Source field ${index + 1}`}>
                          <SelectValue placeholder="Source field" />
                        </SelectTrigger>
                        <SelectContent>
                          {sourceModel?.fields.map((item) => (
                            <SelectItem key={item.name} value={item.name}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.fieldMappings?.[index]
                        ?.sourceField && (
                        <p className="text-destructive text-sm">
                          {
                            form.formState.errors.fieldMappings[index]
                              ?.sourceField?.message
                          }
                        </p>
                      )}
                    </div>
                  )}
                />
                <Controller
                  control={form.control}
                  name={`fieldMappings.${index}.targetField`}
                  render={({ field }) => (
                    <div className="space-y-1">
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={!targetModel}
                      >
                        <SelectTrigger aria-label={`Target field ${index + 1}`}>
                          <SelectValue placeholder="Target field" />
                        </SelectTrigger>
                        <SelectContent>
                          {targetModel?.fields.map((item) => (
                            <SelectItem key={item.name} value={item.name}>
                              {item.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {form.formState.errors.fieldMappings?.[index]
                        ?.targetField && (
                        <p className="text-destructive text-sm">
                          {
                            form.formState.errors.fieldMappings[index]
                              ?.targetField?.message
                          }
                        </p>
                      )}
                    </div>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove mapping ${index + 1}`}
                  disabled={fields.length === 1}
                  onClick={() => remove(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {form.formState.errors.fieldMappings?.root && (
              <p className="text-destructive text-sm">
                {form.formState.errors.fieldMappings.root.message}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <ButtonWithLoading type="submit" loading={isPending}>
              Save relationship
            </ButtonWithLoading>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

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
          args: buildNativeQueryTrackArgs(
            nativeQueryToFormValues(updated),
            updated,
          ),
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
      <Collapsible id="relationships" defaultOpen className="rounded border">
        <CollapsibleTrigger className="group flex w-full items-center justify-between p-4 text-left text-foreground">
          <div>
            <h2 className="font-medium">Relationships</h2>
            <p className="mt-1 text-muted-foreground text-sm">
              {query.object_relationships?.length ?? 0} object ·{' '}
              {query.array_relationships?.length ?? 0} array
            </p>
          </div>
          <ChevronDown className="size-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 border-t p-4">
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSelected(undefined);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add relationship
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
                        ·{' '}
                        {Object.keys(relationship.using.column_mapping).length}{' '}
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
        </CollapsibleContent>
      </Collapsible>

      <RelationshipFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        query={query}
        queries={queries}
        models={models}
        relationship={selected}
        isPending={mutation.isPending}
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
          if (saved) setFormOpen(false);
        }}
      />
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="text-foreground">
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
                if (!selected) return;
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
                if (saved) setDeleteOpen(false);
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
