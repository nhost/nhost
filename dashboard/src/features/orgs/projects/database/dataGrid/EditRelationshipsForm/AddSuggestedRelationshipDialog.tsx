import { useEffect, useMemo, useState } from 'react';

import { Input } from '@/components/ui/v2/Input';
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
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { useCreateArrayRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateArrayRelationshipMutation';
import { useCreateObjectRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useCreateObjectRelationshipMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type {
  RelationshipUsingForeignKeyConstraintOnForeignKeyConstraintOnOneOf,
  SuggestRelationshipsResponseRelationshipsItem,
} from '@/utils/hasura-api/generated/schemas';

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
  if (!value) {
    return '';
  }

  return value.replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '_');
}

function normalizeColumns(columns?: string[] | null) {
  if (!columns || columns.length === 0) {
    return [];
  }

  return columns.filter(Boolean);
}

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

  const [relationshipName, setRelationshipName] = useState(
    sanitizeRelationshipName(getDefaultRelationshipName(suggestion)),
  );
  const [errorMessage, setErrorMessage] = useState<string>();

  const isSubmitting =
    isCreatingObjectRelationship || isCreatingArrayRelationship;

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
      return;
    }

    setRelationshipName(
      sanitizeRelationshipName(getDefaultRelationshipName(suggestion)),
    );
    setErrorMessage(undefined);
  }, [open, suggestion]);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setErrorMessage(undefined);
    }

    setOpen(nextOpen);
  };

  const handleCreateRelationship = async () => {
    if (!suggestion) {
      setErrorMessage('No suggestion selected.');
      return;
    }

    if (!resourceVersion) {
      setErrorMessage(
        'Metadata is not ready yet. Please try again in a moment.',
      );
      return;
    }

    const trimmedName = sanitizeRelationshipName(relationshipName).trim();

    if (!trimmedName) {
      setErrorMessage('Relationship name is required.');
      return;
    }

    const baseTable = suggestion.from?.table ?? {
      schema,
      name: tableName,
    };

    if (!baseTable.schema || !baseTable.name) {
      setErrorMessage('Missing table information for the relationship.');
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
        setErrorMessage(
          'Unable to derive the foreign key information from this suggestion.',
        );
        return;
      }

      promise = createArrayRelationship({
        resourceVersion,
        args: {
          table: baseTable,
          name: trimmedName,
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
        setErrorMessage(
          'Unable to derive the foreign key information from this suggestion.',
        );
        return;
      }

      promise = createObjectRelationship({
        resourceVersion,
        args: {
          table: baseTable,
          name: trimmedName,
          source,
          using: {
            foreign_key_constraint_on: objectForeignKey,
          },
        },
      });
    } else {
      setErrorMessage('Unsupported relationship type.');
      return;
    }

    if (!promise) {
      setErrorMessage('Failed to create the relationship.');
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

        <Input
          id="relationshipName"
          label="Relationship Name"
          value={relationshipName}
          onChange={(event) =>
            setRelationshipName(sanitizeRelationshipName(event.target.value))
          }
          helperText={
            errorMessage ?? (
              <>
                GraphQL fields are limited to letters, numbers, and underscores.
                <br />
                Any spaces are converted to underscores.
              </>
            )
          }
          error={Boolean(errorMessage)}
          autoFocus
          fullWidth
          className="mt-4"
        />

        <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
          <ButtonWithLoading
            onClick={handleCreateRelationship}
            loading={isSubmitting}
            disabled={isSubmitting}
            className="!text-sm+"
          >
            Create Relationship
          </ButtonWithLoading>

          <DialogClose asChild>
            <Button variant="outline" className="!text-sm+ text-foreground">
              Cancel
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
