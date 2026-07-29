import { zodResolver } from '@hookform/resolvers/zod';
import { type Ref, useImperativeHandle, useState } from 'react';
import { useForm } from 'react-hook-form';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormInput } from '@/components/form/FormInput';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { DialogClose, DialogFooter } from '@/components/ui/v3/dialog';
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

export interface ActionRelationshipFormHandle {
  requestClose: () => void;
}

export interface ActionRelationshipFormProps {
  ref: Ref<ActionRelationshipFormHandle>;
  outputTypeFields: CustomTypeObjectField[];
  existingNames: string[];
  initialValue?: ActionRelationship;
  onSubmit: (relationship: ActionRelationship) => Promise<boolean>;
  onClose: () => void;
}

export default function ActionRelationshipForm({
  ref,
  outputTypeFields,
  existingNames,
  initialValue,
  onSubmit,
  onClose,
}: ActionRelationshipFormProps) {
  const isEditing = Boolean(initialValue);

  const outputFieldNames = outputTypeFields.map((field) => field.name);

  const schema = createActionRelationshipFormSchema(
    existingNames,
    outputFieldNames,
  );

  const form = useForm<ActionRelationshipFormValues>({
    resolver: zodResolver(schema),
    defaultValues: initialValue
      ? actionRelationshipToFormValues(initialValue)
      : defaultActionRelationshipFormValues,
  });

  const { isSubmitting, isDirty } = form.formState;

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

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

  const handleDiscardChanges = () => {
    setShowDiscardDialog(false);
    onClose();
  };

  return (
    <>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(async (values) => {
            const saved = await onSubmit(
              formValuesToActionRelationship(values),
            );
            if (saved) {
              onClose();
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
                Choose the relationship type and map this type&apos;s fields to
                the table&apos;s columns.
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
        onDiscardChanges={handleDiscardChanges}
      />
    </>
  );
}
