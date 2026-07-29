import { useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import type { ActionRelationship } from '@/features/orgs/projects/graphql/actions/utils/actionRelationships';
import type { CustomTypeObjectField } from '@/utils/hasura-api/generated/schemas';
import ActionRelationshipForm, {
  type ActionRelationshipFormHandle,
} from './ActionRelationshipForm';

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

  const formRef = useRef<ActionRelationshipFormHandle>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      return;
    }

    formRef.current?.requestClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-h-near-screen overflow-y-auto sm:max-w-[720px]"
        hideCloseButton
        onEscapeKeyDown={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">
            {isEditing ? 'Edit Relationship' : 'Create Relationship'}
          </DialogTitle>
          <DialogDescription>
            Relate this action&apos;s response type to a table in your database.
          </DialogDescription>
        </DialogHeader>

        <ActionRelationshipForm
          ref={formRef}
          outputTypeFields={outputTypeFields}
          existingNames={existingNames}
          initialValue={initialValue}
          onSubmit={onSubmit}
          onClose={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
