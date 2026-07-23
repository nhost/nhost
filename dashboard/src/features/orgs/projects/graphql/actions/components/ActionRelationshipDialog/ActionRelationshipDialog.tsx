import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
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
import { Form, FormDescription } from '@/components/ui/v3/form';
import type { ActionRelationship } from '@/features/orgs/projects/graphql/actions/utils/actionRelationships';
import type { CustomTypeObjectField } from '@/utils/hasura-api/generated/schemas';
import {
  type ActionRelationshipFormValues,
  actionRelationshipToFormValues,
  createActionRelationshipFormSchema,
  defaultActionRelationshipFormValues,
  formValuesToActionRelationship,
} from './ActionRelationshipFormTypes';
import FieldMappingSection from './FieldMappingSection';
import RemoteTableSelector from './RemoteTableSelector';

export interface ActionRelationshipDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  /**
   * Fields of the action's output type, used as the source side of mappings.
   */
  outputTypeFields: CustomTypeObjectField[];
  /**
   * Names already taken by other relationships on the same output type.
   */
  existingNames: string[];
  /**
   * When provided, the dialog edits this relationship instead of creating one.
   */
  initialValue?: ActionRelationship;
  /**
   * Persists the relationship. The dialog closes only when this resolves true.
   */
  onSubmit: (relationship: ActionRelationship) => Promise<boolean>;
}

export default function ActionRelationshipDialog({
  open,
  setOpen,
  outputTypeFields,
  existingNames,
  initialValue,
  onSubmit,
}: ActionRelationshipDialogProps) {
  const isEditing = Boolean(initialValue);

  const outputFieldNames = useMemo(
    () => outputTypeFields.map((field) => field.name),
    [outputTypeFields],
  );

  const schema = useMemo(
    () => createActionRelationshipFormSchema(existingNames, outputFieldNames),
    [existingNames, outputFieldNames],
  );

  const form = useForm<ActionRelationshipFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValue
      ? actionRelationshipToFormValues(initialValue)
      : defaultActionRelationshipFormValues,
  });

  const { isSubmitting, isDirty } = form.formState;

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  useEffect(() => {
    if (open) {
      form.reset(
        initialValue
          ? actionRelationshipToFormValues(initialValue)
          : defaultActionRelationshipFormValues,
      );
    }
  }, [open, form, initialValue]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      return;
    }

    if (isDirty) {
      setShowDiscardDialog(true);
      return;
    }

    setOpen(false);
  };

  const handleDiscardChanges = () => {
    setShowDiscardDialog(false);
    setOpen(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          className="max-h-near-screen overflow-y-auto sm:max-w-[720px]"
          hideCloseButton
          disableOutsideClick={isSubmitting}
          onEscapeKeyDown={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {isEditing ? 'Edit Relationship' : 'Create Relationship'}
            </DialogTitle>
            <DialogDescription>
              Relate this action&apos;s response type to a table in your
              database.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(async (values) => {
                const saved = await onSubmit(
                  formValuesToActionRelationship(values),
                );
                if (saved) {
                  setOpen(false);
                }
              })}
              className="flex flex-col gap-6 text-foreground"
            >
              <FormInput
                control={form.control}
                name="name"
                label="Relationship Name"
                placeholder="Name..."
                autoComplete="off"
                disabled={isEditing}
              />

              <RemoteTableSelector />

              <div className="flex flex-col gap-4 rounded-md border p-4">
                <div className="flex flex-col gap-1">
                  <h3 className="font-semibold text-foreground text-sm">
                    Relationship Details
                  </h3>
                  <FormDescription>
                    Choose the relationship type and map this type&apos;s fields
                    to the table&apos;s columns.
                  </FormDescription>
                </div>

                <FieldMappingSection outputFieldNames={outputFieldNames} />
              </div>

              <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
                <ButtonWithLoading
                  type="submit"
                  loading={isSubmitting}
                  className="!text-sm+"
                >
                  {isEditing ? 'Save Changes' : 'Create Relationship'}
                </ButtonWithLoading>
                <DialogClose asChild>
                  <Button
                    variant="outline"
                    className="!text-sm+ text-foreground"
                  >
                    Cancel
                  </Button>
                </DialogClose>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <DiscardChangesDialog
        open={showDiscardDialog}
        onOpenChange={setShowDiscardDialog}
        onDiscardChanges={handleDiscardChanges}
      />
    </>
  );
}
