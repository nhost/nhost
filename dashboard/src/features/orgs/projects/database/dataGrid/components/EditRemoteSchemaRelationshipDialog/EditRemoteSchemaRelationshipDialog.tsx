import { useCallback, useEffect, useMemo, useState } from 'react';

import { Alert } from '@/components/ui/v2/Alert';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import RemoteSchemaRelationshipDetails, {
  type RemoteSchemaRelationshipDetailsInitialValue,
  type RemoteSchemaRelationshipDetailsValue,
} from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/sections/RemoteSchemaRelationshipDetails';
import { useCreateRemoteRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRemoteRelationshipMutation';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isToRemoteSchemaRelationshipDefinition } from '@/features/orgs/projects/database/dataGrid/types/relationships/guards';
import useGetRemoteSchemas from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas/useGetRemoteSchemas';
import parseRemoteFieldToSelection from '@/features/orgs/projects/remote-schemas/utils/parseRemoteFieldToSelection';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import type {
  RemoteField,
  RemoteRelationshipDefinition,
  RemoteRelationshipItem,
} from '@/utils/hasura-api/generated/schemas';
import { SquarePen } from 'lucide-react';

type MetadataRemoteRelationship = RemoteRelationshipItem & {
  name?: string;
  definition?: RemoteRelationshipDefinition;
};

export interface EditRemoteSchemaRelationshipDialogControlledProps {
  schema: string;
  tableName: string;
  source: string;
  relationship: MetadataRemoteRelationship | null;
  tableColumns: NormalizedQueryDataRow[];
  defaultRemoteSchema?: string;
  onSuccess?: () => Promise<void> | void;
}

export type EditRemoteSchemaRelationshipDialogProps = Omit<
  EditRemoteSchemaRelationshipDialogControlledProps,
  'open' | 'setOpen'
>;

export default function EditRemoteSchemaRelationshipDialog({
  schema,
  tableName,
  source,
  relationship,
  tableColumns,
  defaultRemoteSchema,
  onSuccess,
}: EditRemoteSchemaRelationshipDialogControlledProps) {
  const [open, setOpen] = useState(false);
  const isEditing = Boolean(relationship);
  const [selectedRemoteSchema, setSelectedRemoteSchema] = useState('');
  const [relationshipName, setRelationshipName] = useState('');
  const [remoteFieldDetails, setRemoteFieldDetails] =
    useState<RemoteSchemaRelationshipDetailsValue>({
      lhsFields: [],
      remoteField: undefined,
    });
  const [formError, setFormError] = useState<string | null>(null);

  const { data: remoteSchemas, status: remoteSchemasStatus } =
    useGetRemoteSchemas();

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: createRemoteRelationship, isLoading: isSaving } =
    useCreateRemoteRelationshipMutation();

  // Compute initial value for edit mode
  const initialValue = useMemo<
    RemoteSchemaRelationshipDetailsInitialValue | undefined
  >(() => {
    const relationshipDefinition = relationship?.definition;
    if (
      !relationshipDefinition ||
      !isToRemoteSchemaRelationshipDefinition(relationshipDefinition)
    ) {
      return undefined;
    }

    const parsed = parseRemoteFieldToSelection(
      relationshipDefinition.to_remote_schema.remote_field,
    );
    return {
      rootFieldPath: parsed.rootFieldPath,
      selectedFieldPaths: parsed.selectedFieldPaths,
      argumentMappingsByPath: parsed.argumentMappingsByPath,
    };
  }, [relationship]);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Create mode: preselect the remote schema if provided.
    if (!relationship && defaultRemoteSchema && !selectedRemoteSchema) {
      setSelectedRemoteSchema(defaultRemoteSchema);
    }
  }, [defaultRemoteSchema, open, relationship, selectedRemoteSchema]);

  useEffect(() => {
    const relationshipDefinition = relationship?.definition;
    if (
      !open ||
      !relationshipDefinition ||
      !isToRemoteSchemaRelationshipDefinition(relationshipDefinition)
    ) {
      return;
    }

    const remoteSchemaFromRelationship =
      relationshipDefinition.to_remote_schema.remote_schema ?? '';
    setSelectedRemoteSchema(remoteSchemaFromRelationship);
    setRelationshipName(relationship.name ?? '');
    setFormError(null);
  }, [open, relationship]);

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setFormError(null);
      // Reset the create flow when closing.
      if (!relationship) {
        setSelectedRemoteSchema(defaultRemoteSchema ?? '');
        setRelationshipName('');
        setRemoteFieldDetails({ lhsFields: [], remoteField: undefined });
      }
    }

    setOpen(nextOpen);
  };

  const handleRemoteFieldDetailsChange = useCallback(
    (value: RemoteSchemaRelationshipDetailsValue) => {
      setRemoteFieldDetails(value);
    },
    [],
  );

  const handleSave = async () => {
    if (!resourceVersion) {
      setFormError(
        'Metadata is not ready yet. Please wait a moment and try again.',
      );
      return;
    }

    const name = isEditing
      ? (relationship?.name ?? '').trim()
      : relationshipName.trim();

    if (!name) {
      setFormError('Please provide a relationship name.');
      return;
    }

    if (!selectedRemoteSchema) {
      setFormError('Please select a remote schema.');
      return;
    }

    if (!remoteFieldDetails.remoteField) {
      setFormError('Please provide at least one remote field.');
      return;
    }

    const args = {
      name,
      source,
      table: {
        schema,
        name: tableName,
      },
      definition: {
        to_remote_schema: {
          remote_schema: selectedRemoteSchema,
          lhs_fields: remoteFieldDetails.lhsFields,
          remote_field: remoteFieldDetails.remoteField as RemoteField,
        },
      },
    };

    await execPromiseWithErrorToast(
      async () => {
        await createRemoteRelationship({
          resourceVersion,
          args,
        });
        setOpen(false);
        await onSuccess?.();
      },
      {
        loadingMessage: isEditing
          ? 'Saving relationship...'
          : 'Creating relationship...',
        successMessage: isEditing
          ? 'Relationship updated successfully.'
          : 'Relationship created successfully.',
        errorMessage: isEditing
          ? 'Failed to update remote relationship.'
          : 'Failed to create remote relationship.',
      },
    );
  };

  const isRemoteSchemaDefinition = Boolean(
    relationship?.definition &&
      isToRemoteSchemaRelationshipDefinition(relationship.definition),
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
      >
        <SquarePen className="size-4" />
      </Button>
      <Dialog open={open} onOpenChange={handleDialogChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto text-foreground sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? 'Edit Remote Schema Relationship'
                : 'Create Remote Schema Relationship'}
            </DialogTitle>
          </DialogHeader>

          {relationship && !isRemoteSchemaDefinition ? (
            <Alert severity="error">
              Unable to load this relationship. Please try again later.
            </Alert>
          ) : (
            <div className="flex flex-col gap-6">
              <div className="space-y-2">
                <Label>Relationship name</Label>
                <Input
                  value={
                    isEditing ? (relationship?.name ?? '') : relationshipName
                  }
                  onChange={(event) => setRelationshipName(event.target.value)}
                  disabled={isSaving || isEditing}
                  placeholder="e.g. remote_schema_relationship"
                />
              </div>

              <div className="space-y-2">
                <Label>Remote schema</Label>
                <Select
                  value={selectedRemoteSchema}
                  onValueChange={setSelectedRemoteSchema}
                  disabled={remoteSchemasStatus === 'loading' || isSaving}
                >
                  <SelectTrigger
                    className={cn({
                      'border-destructive': formError && !selectedRemoteSchema,
                    })}
                  >
                    <SelectValue placeholder="Select remote schema" />
                  </SelectTrigger>
                  <SelectContent>
                    {remoteSchemas?.map((remoteSchema) => (
                      <SelectItem
                        key={remoteSchema.name}
                        value={remoteSchema.name}
                      >
                        {remoteSchema.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4 rounded-lg border border-border p-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-medium">Remote fields</h3>
                </div>

                <RemoteSchemaRelationshipDetails
                  remoteSchema={selectedRemoteSchema}
                  tableColumns={tableColumns}
                  disabled={isSaving}
                  onChange={handleRemoteFieldDetailsChange}
                  initialValue={initialValue}
                />
              </div>

              <div>
                <Label>Referenced columns</Label>
                {remoteFieldDetails.lhsFields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Columns will be added automatically as you map arguments to
                    table columns.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {remoteFieldDetails.lhsFields.map((column) => (
                      <span
                        key={column}
                        className="rounded-full bg-muted px-3 py-1 text-sm"
                      >
                        {column}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {formError ? (
                <p className="text-sm text-destructive">{formError}</p>
              ) : null}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setOpen(false)}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleSave} disabled={isSaving}>
                  {isEditing ? 'Save Changes' : 'Create Relationship'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
