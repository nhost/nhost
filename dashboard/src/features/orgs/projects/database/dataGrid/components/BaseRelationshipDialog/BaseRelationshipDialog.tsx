import { zodResolver } from '@hookform/resolvers/zod';
import { useCallback, useEffect, } from 'react';
import { useForm, } from 'react-hook-form';

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
import type { RemoteField } from '@/utils/hasura-api/generated/schemas';
import {
  type BaseRelationshipFormValues,
  buildDefaultFormValues,
  relationshipFormSchema,
} from './BaseRelationshipFormTypes';
import SourceAndReferenceSelector from './SourceAndReferenceSelector';
import RemoteSchemaRelationshipDetails from './sections/RemoteSchemaRelationshipDetails';
import TableRelationshipDetails from './sections/TableRelationshipDetails';

export interface BaseRelationshipDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  /**
   * Source where the relationship is located.
   */
  source: string;
  /**
   * Schema where the relationship is located.
   */
  schema: string;
  /**
   * Table where the relationship is located.
   */
  tableName: string;
  dialogTitle?: string;
  dialogDescription?: string;
  submitButtonText?: string;
  initialValues?: BaseRelationshipFormValues;
  onSubmit: (values: BaseRelationshipFormValues) => Promise<void>;
  isEditing?: boolean;
}

export type CreateRelationshipFormValues = Extract<
  BaseRelationshipFormValues,
  { referenceKind: 'table' }
>;

export default function BaseRelationshipDialog({
  open,
  setOpen,
  dialogTitle = 'Create Relationship',
  dialogDescription = 'Create and track a new relationship in your GraphQL schema.',
  submitButtonText = 'Create Relationship',
  schema,
  tableName,
  source,
  initialValues,
  onSubmit,
  isEditing,
}: BaseRelationshipDialogProps) {
  console.info('initialValues I got:', initialValues);

  const form = useForm<BaseRelationshipFormValues>({
    resolver: zodResolver(relationshipFormSchema),
    defaultValues:
      initialValues ?? buildDefaultFormValues(source, schema, tableName),
  });

  const { formState, reset, watch } = form;
  const { isSubmitting } = formState;

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialValues) {
      reset(initialValues);
      return;
    }

    const defaultValues = buildDefaultFormValues(source, schema, tableName);

    reset(defaultValues);
  }, [open, reset, initialValues, source, schema, tableName]);

  const referenceKind = watch('referenceKind');

  const isRemoteSchemaRelationship = referenceKind === 'remoteSchema';

  const remoteSchemaName = watch('remoteSchema.name');

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !initialValues) {
      form.reset();
    }

    setOpen(nextOpen);
  };

  const handleRemoteSchemaRelationshipDetailsChange = useCallback(
    ({
      lhsFields,
      remoteField,
    }: {
      lhsFields: string[];
      remoteField?: RemoteField;
    }) => {
      if (!remoteSchemaName) {
        return;
      }

      form.setValue(
        'remoteSchema',
        {
          name: remoteSchemaName,
          lhsFields,
          remoteField,
        },
        { shouldDirty: true, shouldValidate: true },
      );
    },
    [form, remoteSchemaName],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[720px]"
        hideCloseButton
        disableOutsideClick={isSubmitting}
      >
        <DialogHeader>
          <DialogTitle className="text-foreground">{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (values) => {
              await onSubmit(values);
              setOpen(false);
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

            <SourceAndReferenceSelector />

            <div className="flex flex-col gap-4 rounded-md border p-4">
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold text-foreground text-sm">
                  Relationship Details
                </h3>
                <FormDescription>
                  {isRemoteSchemaRelationship
                    ? 'Select the remote schema fields for this relationship.'
                    : 'Select the relationship type and map the columns between the tables.'}
                </FormDescription>
              </div>

              {isRemoteSchemaRelationship ? (
                <RemoteSchemaRelationshipDetails
                  onChange={handleRemoteSchemaRelationshipDetailsChange}
                />
              ) : (
                <TableRelationshipDetails />
              )}
            </div>

            <DialogFooter className="gap-2 sm:flex sm:flex-col sm:space-x-0">
              <ButtonWithLoading
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting}
                className="!text-sm+"
              >
                {submitButtonText}
              </ButtonWithLoading>
              <DialogClose asChild>
                <Button variant="outline" className="!text-sm+ text-foreground">
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
