import { Link2, Plus, Split, SquarePen } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import { ActionRelationshipDialog } from '@/features/orgs/projects/actions/components/ActionRelationshipDialog';
import { DeleteActionRelationshipDialog } from '@/features/orgs/projects/actions/components/DeleteActionRelationshipDialog';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';
import {
  type SetActionRelationshipsMode,
  useSetActionRelationshipsMutation,
} from '@/features/orgs/projects/actions/hooks/useSetActionRelationshipsMutation';
import {
  type ActionRelationship,
  buildCustomTypesWithRelationships,
  findOutputObjectType,
  getActionOutputTypeName,
  getActionRelationships,
} from '@/features/orgs/projects/actions/utils/actionRelationships';
import { TextWithTooltip } from '@/features/orgs/projects/common/components/TextWithTooltip';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { triggerToast } from '@/utils/toast';

export interface EditActionRelationshipsFormProps {
  /**
   * Name of the action whose relationships are being edited.
   */
  actionName: string;
  /**
   * Function to be called when the form is cancelled.
   */
  onCancel?: VoidFunction;
}

export default function EditActionRelationshipsForm({
  actionName,
  onCancel,
}: EditActionRelationshipsFormProps) {
  const { data: actionsData, isLoading } = useGetActions();
  const { mutateAsync: setActionRelationships } =
    useSetActionRelationshipsMutation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [relationshipToEdit, setRelationshipToEdit] = useState<
    ActionRelationship | undefined
  >(undefined);

  if (isLoading) {
    return (
      <div className="box flex h-full items-center justify-center p-6">
        <Spinner>Loading relationships...</Spinner>
      </div>
    );
  }

  const action = actionsData?.actions.find((item) => item.name === actionName);
  const customTypes = actionsData?.customTypes ?? {};

  const outputTypeName = action ? getActionOutputTypeName(action) : '';
  const outputObjectType = action
    ? findOutputObjectType(customTypes, outputTypeName)
    : null;
  const relationships = getActionRelationships(outputObjectType);
  const outputTypeFields = outputObjectType?.fields ?? [];

  const existingNames = relationships
    .map((relationship) => relationship.name)
    .filter((name) => name !== relationshipToEdit?.name);

  const persistRelationships = (
    nextRelationships: ActionRelationship[],
    relationshipName: string,
    mode: SetActionRelationshipsMode,
  ) =>
    setActionRelationships({
      customTypes: buildCustomTypesWithRelationships(
        customTypes,
        outputTypeName,
        nextRelationships,
      ),
      previousCustomTypes: customTypes,
      relationshipName,
      outputTypeName,
      mode,
    });

  const handleSubmitRelationship = async (relationship: ActionRelationship) => {
    const isEditing = Boolean(relationshipToEdit);
    const nextRelationships = isEditing
      ? relationships.map((item) =>
          item.name === relationshipToEdit?.name ? relationship : item,
        )
      : [...relationships, relationship];

    try {
      await persistRelationships(nextRelationships, relationship.name, 'save');
      triggerToast(
        isEditing
          ? 'Relationship updated successfully.'
          : 'Relationship created successfully.',
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to save relationship.';
      triggerToast(`Error: ${message}`);
      throw error;
    }
  };

  const handleDeleteRelationship = async (relationshipName: string) => {
    await execPromiseWithErrorToast(
      () =>
        persistRelationships(
          relationships.filter((item) => item.name !== relationshipName),
          relationshipName,
          'remove',
        ),
      {
        loadingMessage: 'Deleting relationship...',
        successMessage: 'Relationship deleted successfully.',
        errorMessage: 'An error occurred while deleting the relationship.',
      },
    );
  };

  const handleAddClick = () => {
    setRelationshipToEdit(undefined);
    setIsDialogOpen(true);
  };

  const handleEditClick = (relationship: ActionRelationship) => {
    setRelationshipToEdit(relationship);
    setIsDialogOpen(true);
  };

  return (
    <div className="box flex flex-auto flex-col content-between overflow-hidden border-t bg-background">
      <div className="flex-auto overflow-y-auto">
        <div className="grid grid-flow-row content-start gap-6 p-6">
          {!action && (
            <p className="text-muted-foreground text-sm">Action not found.</p>
          )}

          {action && !outputObjectType && (
            <p className="text-muted-foreground text-sm">
              The output type{' '}
              <span className="font-mono">{outputTypeName}</span> is not an
              object type, so relationships cannot be attached to it.
            </p>
          )}

          {action && outputObjectType && (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-foreground text-sm+">
                    Relationships
                  </h2>
                  <p className="mt-1 text-muted-foreground text-sm">
                    Relate the{' '}
                    <span className="font-mono">{outputTypeName}</span> response
                    type to tables in your database.
                  </p>
                </div>
                <Button
                  type="button"
                  className="flex w-fit items-center gap-2"
                  onClick={handleAddClick}
                >
                  Relationship
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Name</TableHead>
                    <TableHead className="w-[120px]">Type</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {relationships.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <p className="py-6 text-center text-muted-foreground text-sm">
                          No relationships defined for this action.
                        </p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    relationships.map((relationship) => (
                      <TableRow key={relationship.name}>
                        <TableCell className="max-w-52 font-medium">
                          <TextWithTooltip text={relationship.name} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {relationship.type === 'array' ? (
                              <Split className="h-4 w-4 rotate-90 text-muted-foreground" />
                            ) : (
                              <Link2 className="h-4 w-4 text-muted-foreground" />
                            )}
                            <span className="capitalize">
                              {relationship.type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-0.5 text-muted-foreground text-sm">
                            <span className="font-mono">
                              {relationship.remote_table.schema}.
                              {relationship.remote_table.name}
                            </span>
                            <span>
                              {Object.entries(relationship.field_mapping)
                                .map(
                                  ([field, column]) => `${field} → ${column}`,
                                )
                                .join(', ')}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              aria-label={`Edit relationship ${relationship.name}`}
                              onClick={() => handleEditClick(relationship)}
                              data-testid={`edit-action-rel-${relationship.name}`}
                            >
                              <SquarePen className="size-4" />
                            </Button>
                            <DeleteActionRelationshipDialog
                              relationshipName={relationship.name}
                              onConfirm={() =>
                                handleDeleteRelationship(relationship.name)
                              }
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </div>

      <div className="box grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t p-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {outputObjectType && (
        <ActionRelationshipDialog
          open={isDialogOpen}
          setOpen={setIsDialogOpen}
          outputTypeFields={outputTypeFields}
          existingNames={existingNames}
          initialValue={relationshipToEdit}
          onSubmit={handleSubmitRelationship}
        />
      )}
    </div>
  );
}
