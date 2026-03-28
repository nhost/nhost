import { zodResolver } from '@hookform/resolvers/zod';
import { PencilIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
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
import TextWithTooltip from '@/features/orgs/projects/common/components/TextWithTooltip/TextWithTooltip';
import { useGetMetadataResourceVersion } from '@/features/orgs/projects/common/hooks/useGetMetadataResourceVersion';
import { getRelationshipNameSchema } from '@/features/orgs/projects/database/dataGrid/components/BaseRelationshipDialog/BaseRelationshipFormTypes';
import { useRenameRelationshipMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useRenameRelationshipMutation';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

interface RenameRelationshipDialogProps {
  /**
   * Schema where the relationship is located.
   */
  schema: string;
  /**
   * Table that owns the relationship.
   */
  tableName: string;
  /**
   * Existing relationship name to rename.
   */
  relationshipToRename: string;
  /**
   * Source where the relationship lives.
   *
   * @default 'default'
   */
  source?: string;
  /**
   * Optional callback triggered after a successful rename.
   */
  onSuccess?: () => Promise<void> | void;
}

const RELATIONSHIP_NAME_HELPER_TEXT =
  'GraphQL fields are limited to letters, numbers, and underscores.';

const validationSchema = z.object({
  newRelationshipName: getRelationshipNameSchema('Relationship name'),
});

type RenameRelationshipFormValues = z.infer<typeof validationSchema>;

export default function RenameRelationshipDialog({
  schema,
  tableName,
  relationshipToRename,
  source = 'default',
  onSuccess,
}: RenameRelationshipDialogProps) {
  const [open, setOpen] = useState(false);
  const { mutateAsync: renameRelationship, isLoading: isRenamingRelationship } =
    useRenameRelationshipMutation();

  const { data: resourceVersion } = useGetMetadataResourceVersion();

  const relationshipNameInputRef = useRef<HTMLInputElement | null>(null);

  const renameForm = useForm<RenameRelationshipFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      newRelationshipName: relationshipToRename,
    },
  });

  const { control, handleSubmit, reset, setError, clearErrors, formState } =
    renameForm;

  const isSubmitting = isRenamingRelationship || formState.isSubmitting;

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    reset({ newRelationshipName: relationshipToRename });
    clearErrors('newRelationshipName');

    // const timer = setTimeout(() => {
    //   relationshipNameInputRef.current?.focus();
    //   relationshipNameInputRef.current?.select();
    // }, 0);

    // return () => {
    //   clearTimeout(timer);
    // };
  }, [open, relationshipToRename, reset, clearErrors]);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      clearErrors('newRelationshipName');
    }

    setOpen(nextOpen);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && isSubmitting) {
      return;
    }

    handleClose(nextOpen);
  };

  const handleRenameRelationship = async ({
    newRelationshipName,
  }: RenameRelationshipFormValues) => {
    if (!resourceVersion) {
      setError('newRelationshipName', {
        type: 'manual',
        message: 'Metadata is not ready yet. Please try again in a moment.',
      });
      return;
    }

    await execPromiseWithErrorToast(
      async () => {
        await renameRelationship({
          resourceVersion,
          args: {
            table: {
              schema,
              name: tableName,
            },
            name: relationshipToRename,
            new_name: newRelationshipName,
            source,
          },
        });
      },
      {
        loadingMessage: 'Renaming relationship...',
        successMessage: 'Relationship renamed successfully.',
        errorMessage: 'An error occurred while renaming the relationship.',
      },
    );

    handleClose(false);
    await onSuccess?.();
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
      >
        <PencilIcon className="size-4" />
      </Button>

      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          className="sm:max-w-[425px]"
          hideCloseButton
          disableOutsideClick={isSubmitting}
          onEscapeKeyDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              Rename{' '}
              <TextWithTooltip
                text={relationshipToRename}
                className="rounded-md bg-muted px-1 py-0.5 font-medium font-mono"
                containerClassName="inline-flex max-w-sm"
              />{' '}
            </DialogTitle>
            <DialogDescription>
              Provide a new name for the relationship.
            </DialogDescription>
          </DialogHeader>

          <Form {...renameForm}>
            <form
              onSubmit={handleSubmit(handleRenameRelationship)}
              className="flex flex-col gap-2 pt-2 text-foreground"
            >
              <FormInput<RenameRelationshipFormValues>
                ref={relationshipNameInputRef}
                control={control}
                name="newRelationshipName"
                label="New Relationship Name"
                helperText={
                  formState.errors.newRelationshipName
                    ? null
                    : RELATIONSHIP_NAME_HELPER_TEXT
                }
              />

              <DialogFooter className="gap-2 pt-4 sm:flex sm:flex-col sm:space-x-0">
                <ButtonWithLoading
                  type="submit"
                  loading={isSubmitting}
                  disabled={isSubmitting || !formState.isDirty}
                  className="!text-sm+"
                >
                  Rename
                </ButtonWithLoading>
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className="!text-sm+ text-foreground"
                    type="button"
                    disabled={isSubmitting}
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
