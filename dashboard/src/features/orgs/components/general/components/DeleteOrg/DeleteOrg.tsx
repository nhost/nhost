import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormCheckbox } from '@/components/form/FormCheckbox';
import { FormInput } from '@/components/form/FormInput';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/v3/alert-dialog';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { InlineCode } from '@/components/ui/v3/inline-code';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDeleteOrganizationMutation } from '@/generated/graphql';

interface DeleteOrgFormValues {
  confirmation: string;
  acknowledgeIrreversible: boolean;
}

export default function DeleteOrg() {
  const router = useRouter();
  const { org } = useCurrentOrg();
  const isOrgAdmin = useIsOrgAdmin();
  const { refetch: refetchOrgs } = useOrgs();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteOrgMutation] = useDeleteOrganizationMutation();
  const deleteDisabled = deleting || !isOrgAdmin;
  const requiredOrganizationConfirmation =
    typeof org?.name === 'string' && org.name.length > 0 ? org.name : null;

  const validationSchema = useMemo(
    () =>
      z.object({
        confirmation: z
          .string()
          .min(1, { message: 'Typing the organization name is required' })
          .refine(
            (value) =>
              requiredOrganizationConfirmation !== null &&
              value === requiredOrganizationConfirmation,
            { message: 'Value does not match' },
          ),
        // An empty message suppresses FormMessage; the disabled action is the
        // only affordance the acknowledgment needs.
        acknowledgeIrreversible: z
          .boolean()
          .refine((value) => value, { message: '' }),
      }),
    [requiredOrganizationConfirmation],
  );

  const form = useForm<DeleteOrgFormValues>({
    resolver: zodResolver(validationSchema),
    mode: 'onChange',
    defaultValues: {
      confirmation: '',
      acknowledgeIrreversible: false,
    },
  });
  const { isValid } = form.formState;
  const canDeleteOrganization = isValid && isOrgAdmin && !deleting;

  const handleDeleteOrg = async () => {
    if (!isOrgAdmin || deleting) {
      return;
    }

    setDeleting(true);

    try {
      await execPromiseWithErrorToast(
        async () => {
          await deleteOrgMutation({
            variables: {
              id: org?.id,
            },
            onCompleted: async () => {
              await refetchOrgs();
              await router.push('/');
            },
          });
        },
        {
          loadingMessage: 'Deleting the organization',
          successMessage: 'Successfully deleted the organization',
          errorMessage: 'An error occurred while deleting the organization!',
        },
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex w-full flex-col rounded-md border border-destructive bg-background">
      <div className="flex w-full flex-col gap-2 border-b p-4 font-medium">
        <h3>Delete Organization</h3>
        <p className="font-normal text-muted-foreground text-sm">
          Proceed with caution, as this action is irreversible and will
          permanently remove the organization.
        </p>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-2">
        {!isOrgAdmin && (
          <p className="mr-auto flex items-center gap-2 text-muted-foreground text-sm">
            <Lock className="h-4 w-4 shrink-0" />
            Only organization admins can delete this organization.
          </p>
        )}
        <AlertDialog
          open={open}
          onOpenChange={(nextOpen) => {
            // Never dismiss while the mutation is in flight.
            if (!nextOpen && deleting) {
              return;
            }

            setOpen(nextOpen);

            if (!nextOpen) {
              form.reset();
            }
          }}
        >
          <span className={deleteDisabled ? 'cursor-not-allowed' : undefined}>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleteDisabled}>
                Delete
              </Button>
            </AlertDialogTrigger>
          </span>
          <AlertDialogContent className="flex w-full flex-col gap-6 text-left text-foreground">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Organization</AlertDialogTitle>
              <AlertDialogDescription className="flex flex-col gap-2">
                Are you sure you want to delete this Organization?
                <span className="font-bold text-destructive">
                  This cannot be undone.
                </span>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <Form {...form}>
              <form
                id="delete-org-form"
                onSubmit={form.handleSubmit(handleDeleteOrg)}
                className="flex flex-col gap-6"
              >
                <FormCheckbox
                  control={form.control}
                  name="acknowledgeIrreversible"
                  label="I understand this action cannot be undone"
                  className="mt-0.5 self-start"
                />

                <FormInput
                  control={form.control}
                  name="confirmation"
                  autoComplete="off"
                  className="border-border font-mono"
                  disabled={!requiredOrganizationConfirmation}
                  label={
                    requiredOrganizationConfirmation ? (
                      <>
                        Type{' '}
                        <InlineCode className="max-w-full select-none whitespace-pre-wrap break-words text-sm">
                          {requiredOrganizationConfirmation}
                        </InlineCode>{' '}
                        to confirm
                      </>
                    ) : (
                      'Organization confirmation is unavailable.'
                    )
                  }
                  helperText={
                    requiredOrganizationConfirmation
                      ? undefined
                      : 'An organization name is required to enable deletion.'
                  }
                />
              </form>
            </Form>

            <AlertDialogFooter className="gap-2 sm:space-x-0">
              <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
              <ButtonWithLoading
                type="submit"
                form="delete-org-form"
                variant="destructive"
                data-testid="deleteOrgButton"
                disabled={!canDeleteOrganization}
                loading={deleting}
              >
                Delete Organization
              </ButtonWithLoading>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
