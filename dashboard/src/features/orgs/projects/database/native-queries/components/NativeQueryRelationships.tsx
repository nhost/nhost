import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Pencil, Plus, Trash2 } from 'lucide-react';
import NextLink from 'next/link';
import { type Ref, useImperativeHandle, useRef, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
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
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { Form } from '@/components/ui/v3/form';
import { SelectItem, SelectSeparator } from '@/components/ui/v3/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import useNativeQueryMetadataMutation from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation';
import buildNativeQueryTrackArgs from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';
import { nativeQueryToFormValues } from '@/features/orgs/projects/database/native-queries/utils/nativeQueryOperations';
import {
  addNativeQueryRelationship,
  columnMappingToFieldMappings,
  hasNativeQueryRelationshipName,
  type NativeQueryRelationshipInput,
  type NativeQueryRelationshipKind,
  removeNativeQueryRelationship,
  updateNativeQueryRelationship,
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
  onSubmit: (values: RelationshipFormValues) => Promise<void>;
}

const emptyValues: RelationshipFormValues = {
  name: '',
  kind: 'object',
  remoteNativeQuery: '',
  fieldMappings: [],
  insertionOrder: null,
};

interface RelationshipFormHandle {
  requestClose: () => void;
}

interface RelationshipFormProps {
  ref: Ref<RelationshipFormHandle>;
  query: NativeQueryItem;
  queries: NativeQueryItem[];
  models: LogicalModelItem[];
  relationship?: RelationshipWithKind;
  onSubmit: (values: RelationshipFormValues) => Promise<void>;
  onClose: () => void;
}

function RelationshipForm({
  ref,
  query,
  queries,
  models,
  relationship,
  onSubmit,
  onClose,
}: RelationshipFormProps) {
  const form = useForm<RelationshipFormValues>({
    resolver: zodResolver(relationshipSchema),
    defaultValues: relationship
      ? {
          name: relationship.relationship.name,
          kind: relationship.kind,
          remoteNativeQuery:
            relationship.relationship.using.remote_native_query,
          fieldMappings: columnMappingToFieldMappings(
            relationship.relationship.using.column_mapping,
          ),
          insertionOrder: relationship.relationship.using.insertion_order,
        }
      : emptyValues,
  });
  const { control } = form;
  const { isSubmitting, isDirty, errors } = form.formState;
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'fieldMappings',
  });
  const targetName = useWatch({ control, name: 'remoteNativeQuery' });
  const watchedMappings = useWatch({ control, name: 'fieldMappings' }) ?? [];

  const sourceModel = models.find((model) => model.name === query.returns);
  const sourceFieldNames = sourceModel?.fields.map((field) => field.name) ?? [];
  const targetQuery = queries.find(
    (item) => item.root_field_name === targetName,
  );
  const targetModel = models.find(
    (model) => model.name === targetQuery?.returns,
  );
  const targetFieldNames = targetModel?.fields.map((field) => field.name) ?? [];

  const selectedSourceFields = new Set(
    watchedMappings
      .map((mapping) => mapping?.sourceField)
      .filter(Boolean) as string[],
  );
  const firstUnusedSourceField =
    sourceFieldNames.find((name) => !selectedSourceFields.has(name)) ?? '';
  const allSourceFieldsSelected =
    sourceFieldNames.length > 0 &&
    sourceFieldNames.every((name) => selectedSourceFields.has(name));

  const fieldMappingsError =
    errors.fieldMappings?.root?.message ?? errors.fieldMappings?.message;

  useImperativeHandle(ref, () => ({
    requestClose: () => {
      if (isSubmitting) {
        return;
      }
      if (isDirty) {
        setShowDiscardDialog(true);
        return;
      }
      onClose();
    },
  }));

  return (
    <>
      <Form {...form}>
        <form
          className="flex flex-col gap-5"
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
          <FormInput
            control={control}
            name="name"
            label="Relationship Name"
            placeholder="Name..."
            autoComplete="off"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormSelect
              control={control}
              name="remoteNativeQuery"
              label="Target Native Query"
              placeholder="Select a query"
              transform={{
                in: (storedValue: string) => storedValue,
                out: (selectedValue: string) => {
                  form.setValue('fieldMappings', [], { shouldDirty: true });
                  return selectedValue;
                },
              }}
            >
              {queries.map((item) => (
                <SelectItem
                  key={item.root_field_name}
                  value={item.root_field_name}
                >
                  {item.root_field_name}
                </SelectItem>
              ))}
            </FormSelect>

            <FormSelect control={control} name="kind" label="Relationship Type">
              <SelectItem value="object">Object Relationship</SelectItem>
              <SelectItem value="array">Array Relationship</SelectItem>
            </FormSelect>
          </div>

          <div className="space-y-2 rounded-md border p-4">
            <div className="grid grid-cols-12 items-center gap-2 font-semibold text-muted-foreground text-sm">
              <span className="col-span-5">Source fields</span>
              <div className="col-span-2 flex justify-center">
                <ArrowRight className="h-4 w-4" />
              </div>
              <span className="col-span-5 text-right">Target fields</span>
            </div>
            <SelectSeparator />
            <div className="space-y-3">
              {fields.map((mapping, index) => (
                <div
                  key={mapping.id}
                  className="grid grid-cols-12 items-center gap-2"
                >
                  <FormSelect
                    control={control}
                    name={`fieldMappings.${index}.sourceField`}
                    placeholder="Select source field"
                    containerClassName="col-span-5"
                    data-testid={`fieldMappings.${index}.sourceField`}
                  >
                    {sourceFieldNames.map((fieldName) => (
                      <SelectItem
                        key={fieldName}
                        value={fieldName}
                        disabled={
                          selectedSourceFields.has(fieldName) &&
                          watchedMappings[index]?.sourceField !== fieldName
                        }
                      >
                        {fieldName}
                      </SelectItem>
                    ))}
                    {sourceFieldNames.length === 0 && (
                      <SelectItem disabled value="__no-source-fields">
                        No fields available
                      </SelectItem>
                    )}
                  </FormSelect>

                  <div className="col-span-2 flex justify-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <FormSelect
                    control={control}
                    name={`fieldMappings.${index}.targetField`}
                    placeholder="Select target field"
                    containerClassName="col-span-4 col-start-8"
                    data-testid={`fieldMappings.${index}.targetField`}
                    disabled={!targetModel}
                  >
                    {targetFieldNames.map((fieldName) => (
                      <SelectItem key={fieldName} value={fieldName}>
                        {fieldName}
                      </SelectItem>
                    ))}
                    {targetFieldNames.length === 0 && (
                      <SelectItem disabled value="__no-target-fields">
                        No fields available
                      </SelectItem>
                    )}
                  </FormSelect>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-span-1 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`Remove mapping ${index + 1}`}
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}

              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2"
                  onClick={() =>
                    append({
                      sourceField: firstUnusedSourceField,
                      targetField: targetFieldNames[0] ?? '',
                    })
                  }
                  disabled={
                    sourceFieldNames.length === 0 ||
                    targetFieldNames.length === 0 ||
                    allSourceFieldsSelected
                  }
                >
                  <Plus className="h-4 w-4" /> Add New Mapping
                </Button>
              </div>

              {fieldMappingsError && (
                <p className="font-medium text-destructive text-sm">
                  {fieldMappingsError}
                </p>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
            <ButtonWithLoading
              type="submit"
              loading={isSubmitting}
              className="!text-sm+"
            >
              {relationship ? 'Save Changes' : 'Create Relationship'}
            </ButtonWithLoading>
            <DialogClose asChild>
              <Button variant="outline" className="!text-sm+ text-foreground">
                Cancel
              </Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </Form>

      <DiscardChangesDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onDiscardChanges={() => {
          setShowDiscardDialog(false);
          onClose();
        }}
      />
    </>
  );
}

export function RelationshipFormDialog({
  open,
  onOpenChange,
  query,
  queries,
  models,
  relationship,
  onSubmit,
}: RelationshipFormDialogProps) {
  const formRef = useRef<RelationshipFormHandle>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      return;
    }
    formRef.current?.requestClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto text-foreground sm:max-w-[720px]"
        hideCloseButton
        onEscapeKeyDown={(event) => event.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>
            {relationship ? 'Edit Relationship' : 'Create Relationship'}
          </DialogTitle>
          <DialogDescription>
            Map fields from this query to fields returned by a target query.
          </DialogDescription>
        </DialogHeader>
        <RelationshipForm
          ref={formRef}
          query={query}
          queries={queries}
          models={models}
          relationship={relationship}
          onSubmit={onSubmit}
          onClose={() => onOpenChange(false)}
        />
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
