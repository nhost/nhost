import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { FormInput } from '@/components/form/FormInput';
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
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useCreateRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateRelationshipMutation';
import { normalizeColumns } from '@/features/orgs/projects/database/dataGrid/utils/normalizeColumns';
import { prepareSuggestedRelationshipDTO } from '@/features/orgs/projects/database/dataGrid/utils/prepareSuggestedRelationshipDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  CreateLocalRelationshipArgs,
  SuggestedArrayRelationship,
  SuggestedObjectRelationship,
} from '@/utils/hasura-api/generated/schemas';

interface AddSuggestedRelationshipDialogProps {
  /**
   * Source where the relationship will be created.
   *
   * @default 'default'
   */
  source?: string;
  /**
   * Schema where the new relationship will be created.
   */
  schema: string;
  /**
   * Table where the new relationship will be created.
   */
  tableName: string;
  /**
   * Default name of the relationship.
   */
  defaultRelationshipName: string;
  /**
   * Suggested relationship to be transformed into a tracked relationship.
   */
  suggestion: SuggestedObjectRelationship | SuggestedArrayRelationship;
}

const RELATIONSHIP_NAME_VALIDATION_MESSAGE =
  'Relationship name is required. GraphQL fields are limited to letters, numbers, and underscores.';

type AddSuggestedRelationshipFormValues = {
  relationshipName: string;
};

export default function AddSuggestedRelationshipDialog({
  source = 'default',
  schema,
  tableName,
  suggestion,
  defaultRelationshipName,
}: AddSuggestedRelationshipDialogProps) {
  const [open, setOpen] = useState(false);
  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const { mutateAsync: createRelationship, isPending: isCreatingRelationship } =
    useCreateRelationshipMutation();

  const relationshipForm = useForm<AddSuggestedRelationshipFormValues>({
    defaultValues: {
      relationshipName: defaultRelationshipName,
    },
  });

  const { control, handleSubmit, reset, setError, clearErrors, formState } =
    relationshipForm;

  const isSubmitting = isCreatingRelationship || formState.isSubmitting;

  const relationshipSummary = useMemo(() => {
    const fromTable = suggestion.from?.table;
    const toTable = suggestion.to?.table;

    if (!fromTable || !toTable) {
      return '';
    }

    const fromColumns = normalizeColumns(suggestion.from?.columns);
    const toColumns = normalizeColumns(suggestion.to?.columns);

    const fromColumnsStr =
      fromColumns.length > 0 ? ` / ${fromColumns.join(', ')}` : '';
    const toColumnsStr =
      toColumns.length > 0 ? ` / ${toColumns.join(', ')}` : '';

    return `${fromTable.schema}.${fromTable.name}${fromColumnsStr} → ${toTable.schema}.${toTable.name}${toColumnsStr}`;
  }, [suggestion]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    reset({ relationshipName: defaultRelationshipName });
    clearErrors('relationshipName');
  }, [open, defaultRelationshipName, reset, clearErrors]);

  const showRelationshipNameError = (message: string) => {
    setError('relationshipName', {
      type: 'manual',
      message,
    });
  };

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      clearErrors('relationshipName');
    }

    setOpen(nextOpen);
  };

  const handleCreateRelationship = async ({
    relationshipName,
  }: AddSuggestedRelationshipFormValues) => {
    clearErrors('relationshipName');

    if (!suggestion) {
      showRelationshipNameError('No suggestion selected.');
      return;
    }

    if (!resourceVersion) {
      showRelationshipNameError(
        'Metadata is not ready yet. Please try again in a moment.',
      );
      return;
    }

    const trimmedName = relationshipName.trim();

    if (!trimmedName) {
      showRelationshipNameError(RELATIONSHIP_NAME_VALIDATION_MESSAGE);
      return;
    }

    const baseTable = suggestion.from?.table ?? {
      schema,
      name: tableName,
    };

    if (!baseTable.schema || !baseTable.name) {
      showRelationshipNameError(
        'Missing table information for the relationship.',
      );
      return;
    }

    let args: CreateLocalRelationshipArgs;
    const type =
      suggestion.type === 'array'
        ? 'pg_create_array_relationship'
        : 'pg_create_object_relationship';
    try {
      args = prepareSuggestedRelationshipDTO({
        baseTable,
        relationshipName,
        source,
        suggestion,
      });
    } catch (error) {
      showRelationshipNameError(
        error instanceof Error
          ? error.message
          : 'An error occurred while preparing the relationship.',
      );
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await createRelationship({
          resourceVersion,
          args,
          type,
        });
      },
      {
        loadingMessage: 'Creating relationship...',
        successMessage: 'Relationship created successfully.',
        errorMessage: 'An error occurred while creating the relationship.',
      },
    );

    handleClose(false);
  };

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Add
      </Button>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent
          className="sm:max-w-[425px]"
          hideCloseButton
          disableOutsideClick={isSubmitting}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Add Suggested Relationship
            </DialogTitle>
            <DialogDescription>
              Review the relationship details and confirm to add it to your
              metadata.
            </DialogDescription>
          </DialogHeader>

          <p className="text-foreground text-sm">
            Type:{' '}
            <span className="font-normal text-foreground">
              {suggestion.type === 'array' ? 'Array' : 'Object'} Relationship
            </span>
          </p>

          <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground text-sm">
            {relationshipSummary}
          </p>

          <Form {...relationshipForm}>
            <form
              onSubmit={handleSubmit(handleCreateRelationship)}
              className="flex flex-col gap-4 text-foreground"
            >
              <FormInput
                control={control}
                name="relationshipName"
                label="Relationship Name"
                containerClassName="mt-0"
              />

              <DialogFooter className="gap-2 pt-2 sm:flex sm:flex-col sm:space-x-0">
                <ButtonWithLoading
                  type="submit"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                  className="!text-sm+"
                >
                  Create Relationship
                </ButtonWithLoading>

                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className="!text-sm+ text-foreground"
                    type="button"
                  >
                    Cancel
                  </Button>
                </DialogClose>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
