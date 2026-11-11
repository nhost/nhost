import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { FormCheckbox } from '@/components/form/FormCheckbox';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
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
  acknowledgeDeletion: boolean;
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
  const requiredOrganizationConfirmation = org?.name;

  const validationSchema = useMemo(
    () =>
      z.object({
        confirmation: z
          .string()
          .min(1, { message: 'Typing the organization name is required' })
          .refine((value) => value === requiredOrganizationConfirmation, {
            message: 'Value does not match',
          }),
        acknowledgeDeletion: z
          .boolean()
          .refine((value) => value, { message: '' }),
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
      acknowledgeDeletion: false,
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
    <SettingsCard>
      <SettingsCardHeader
        size="lg"
        title="Delete organization"
        description="Proceed with caution, as this action is irreversible and will permanently remove the organization."
        control={
          <>
            {!isOrgAdmin && (
              <Alert className="font-normal">
                <AlertDescription>
                  Only organization admins can delete this organization.
                </AlertDescription>
              </Alert>
            )}
            <AlertDialog
              open={open}
              onOpenChange={(nextOpen) => {
                if (!nextOpen && deleting) {
                  return;
                }

                setOpen(nextOpen);

                if (!nextOpen) {
                  form.reset();
                }
              }}
            >
              <span
                className={deleteDisabled ? 'cursor-not-allowed' : undefined}
              >
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={deleteDisabled}
                    className="w-full sm:w-auto"
                  >
                    Delete
                  </Button>
                </AlertDialogTrigger>
              </span>
              <AlertDialogContent className="flex w-full max-w-lg flex-col gap-6 p-12 text-left text-foreground">
                <AlertDialogHeader className="gap-2">
                  <AlertDialogTitle className="text-xl">
                    {org?.name ? `Delete ${org.name}` : 'Delete organization'}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    Deleting an organization removes it and all its projects,
                    and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                <Form {...form}>
                  <form
                    id="delete-org-form"
                    onSubmit={form.handleSubmit(handleDeleteOrg)}
                    className="flex flex-col gap-6"
                  >
                    <div className="flex flex-col gap-3 rounded-lg border p-4">
                      <FormCheckbox
                        control={form.control}
                        name="acknowledgeDeletion"
                        label="I'm sure I want to delete this organization"
                      />

                      <FormCheckbox
                        control={form.control}
                        name="acknowledgeIrreversible"
                        label="I understand this action cannot be undone"
                      />
                    </div>

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
                            <InlineCode className="max-w-full whitespace-pre-wrap break-words bg-input text-foreground text-sm dark:bg-input">
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

                <AlertDialogFooter className="mt-6 gap-2 sm:space-x-0">
                  <AlertDialogCancel disabled={deleting}>
                    Cancel
                  </AlertDialogCancel>
                  <ButtonWithLoading
                    type="submit"
                    form="delete-org-form"
                    variant="destructive"
                    data-testid="deleteOrgButton"
                    disabled={!canDeleteOrganization}
                    loading={deleting}
                  >
                    Delete organization
                  </ButtonWithLoading>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        }
      />
    </SettingsCard>
  );
}
