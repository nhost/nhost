import { useEffect, useMemo, useRef } from 'react';

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
import { useCreateArrayRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateArrayRelationshipMutation';
import { useCreateObjectRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateObjectRelationshipMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { SuggestRelationshipsResponseRelationshipsItem } from '@/utils/hasura-api/generated/schemas';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';

interface AddSuggestedRelationshipDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
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
   * Suggested relationship to be transformed into a tracked relationship.
   */
  suggestion?: SuggestRelationshipsResponseRelationshipsItem | null;
  /**
   * Optional callback triggered after successfully creating the relationship.
   */
  onSuccess?: () => Promise<void> | void;
}

function getDefaultRelationshipName(
  suggestion?: SuggestRelationshipsResponseRelationshipsItem | null,
) {
  if (!suggestion) {
    return '';
  }

  const targetTable =
    suggestion.type?.toLowerCase() === 'array'
      ? suggestion.to?.table?.name
      : (suggestion.to?.table?.name ?? suggestion.from?.table?.name);

  if (!targetTable) {
    return '';
  }

  return `${targetTable}_${suggestion.type ?? 'relationship'}`;
}

function sanitizeRelationshipName(value?: string | null) {
  return value ?? '';
}

function normalizeColumns(columns?: string[] | null) {
  if (!columns || columns.length === 0) {
    return [];
  }

  return columns.filter(Boolean);
}

const RELATIONSHIP_NAME_VALIDATION_MESSAGE =
  'Relationship name is required. GraphQL fields are limited to letters, numbers, and underscores.';

type AddSuggestedRelationshipFormValues = {
  relationshipName: string;
};

export default function AddSuggestedRelationshipDialog({
  open,
  setOpen,
  source = 'default',
  schema,
  tableName,
  suggestion,
  onSuccess,
}: AddSuggestedRelationshipDialogProps) {
  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const {
    mutateAsync: createObjectRelationship,
    isLoading: isCreatingObjectRelationship,
  } = useCreateObjectRelationshipMutation();

  const {
    mutateAsync: createArrayRelationship,
    isLoading: isCreatingArrayRelationship,
  } = useCreateArrayRelationshipMutation();

  const defaultRelationshipName = useMemo(
    () => sanitizeRelationshipName(getDefaultRelationshipName(suggestion)),
    [suggestion],
  );

  const relationshipNameInputRef = useRef<HTMLInputElement | null>(null);

  const relationshipForm = useForm<AddSuggestedRelationshipFormValues>({
    defaultValues: {
      relationshipName: defaultRelationshipName,
    },
  });

  const { control, handleSubmit, reset, setError, clearErrors, formState } =
    relationshipForm;

  const queryClient = useQueryClient();

  const isSubmitting =
    isCreatingObjectRelationship ||
    isCreatingArrayRelationship ||
    formState.isSubmitting;

  const suggestionType = suggestion?.type?.toLowerCase();

  const relationshipSummary = useMemo(() => {
    if (!suggestion) {
      return '';
    }

    const fromTable = suggestion.from?.table;
    const toTable = suggestion.to?.table;

    if (!fromTable || !toTable) {
      return '';
    }

    return `${fromTable.schema}.${fromTable.name} → ${toTable.schema}.${toTable.name}`;
  }, [suggestion]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    reset({ relationshipName: defaultRelationshipName });
    clearErrors('relationshipName');

    const timer = setTimeout(() => {
      relationshipNameInputRef.current?.focus();
      relationshipNameInputRef.current?.select();
    }, 0);

    return () => {
      clearTimeout(timer);
    };
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

    let promise: Promise<unknown> | undefined;

    if (suggestionType === 'array') {
      const remoteTable = suggestion.to?.table;
      const remoteColumns = normalizeColumns(suggestion.to?.columns);

      const arrayForeignKey:
        | string
        | RelationshipUsingForeignKeyConstraintOnForeignKeyConstraintOnOneOf
        | undefined =
        remoteTable && remoteColumns.length > 0
          ? {
              table: remoteTable,
              columns:
                remoteColumns.length === 1
                  ? (remoteColumns[0] as unknown as string)
                  : (remoteColumns as unknown as string),
            }
          : suggestion.to?.constraint_name;

      if (!arrayForeignKey) {
        showRelationshipNameError(
          'Unable to derive the foreign key information from this suggestion.',
        );
        return;
      }

      promise = createArrayRelationship({
        resourceVersion,
        args: {
          table: baseTable,
          name: relationshipName,
          source,
          using: {
            foreign_key_constraint_on: arrayForeignKey,
          },
        },
      });
    } else if (suggestionType === 'object') {
      const localColumns = normalizeColumns(suggestion.from?.columns);

      const objectForeignKey:
        | string
        | RelationshipUsingForeignKeyConstraintOnForeignKeyConstraintOnOneOf
        | undefined =
        suggestion.from?.constraint_name ??
        (localColumns.length === 1
          ? localColumns[0]
          : (localColumns as unknown as string)) ??
        suggestion.to?.constraint_name;

      if (!objectForeignKey) {
        showRelationshipNameError(
          'Unable to derive the foreign key information from this suggestion.',
        );
        return;
      }

      promise = createObjectRelationship({
        resourceVersion,
        args: {
          table: baseTable,
          name: relationshipName,
          source,
          using: {
            foreign_key_constraint_on: objectForeignKey,
          },
        },
      });
    } else {
      showRelationshipNameError('Unsupported relationship type.');
      return;
    }

    if (!promise) {
      showRelationshipNameError('Failed to create the relationship.');
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await promise;
      },
      {
        loadingMessage: 'Creating relationship...',
        successMessage: 'Relationship created successfully.',
        errorMessage: 'An error occurred while creating the relationship.',
      },
    );

    await Promise.allSettled([
      queryClient.invalidateQueries({
        queryKey: ['export-metadata'],
        exact: false,
      }),
      queryClient.invalidateQueries({
        queryKey: ['suggest-relationships', source],
      }),
    ]);

    handleClose(false);
    await onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="sm:max-w-[480px]"
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

        {relationshipSummary && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {relationshipSummary}
          </p>
        )}

        <Form {...relationshipForm}>
          <form
            onSubmit={handleSubmit(handleCreateRelationship)}
            className="mt-4 flex flex-col gap-4 text-foreground"
          >
            <FormInput
              ref={relationshipNameInputRef}
              control={control}
              name="relationshipName"
              label="Relationship Name"
              containerClassName="mt-0"
            />

            <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
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
  );
}
