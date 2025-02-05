import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';

import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import FinishOrgCreation from '@/features/orgs/components/common/TransferProjectDialog/FinishOrgCreation';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import type { FinishOrgCreationOnCompletedCb } from '@/features/orgs/hooks/useFinishOrgCreation/useFinishOrgCreation';
import { useOrgs, type Org } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn, isNotEmptyValue } from '@/lib/utils';
import {
  Organization_Members_Role_Enum,
  useBillingTransferAppMutation,
} from '@/utils/__generated__/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUserId } from '@nhost/nextjs';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const CREATE_NEW_ORG = 'createNewOrg';
interface TransferProjectDialogProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}

const transferProjectFormSchema = z.object({
  organization: z.string(),
});

export default function TransferProjectDialog({
  open,
  setOpen,
}: TransferProjectDialogProps) {
  const { push, asPath, query, replace, pathname } = useRouter();
  const { session_id, test, ...remainingQuery } = query;
  const currentUserId = useUserId();
  const { project, loading: projectLoading } = useProject();
  const {
    orgs,
    currentOrg,
    loading: orgsLoading,
    refetch: refetchOrgs,
  } = useOrgs();
  const [transferProject] = useBillingTransferAppMutation();
  const [showCreateOrgModal, setShowCreateOrgModal] = useState(false);
  const [finishOrgCreation, setFinishOrgCreation] = useState(false);
  const [preventClose, setPreventClose] = useState(false);
  const [newOrgSlug, setNewOrgSlug] = useState<string | undefined>();

  const form = useForm<z.infer<typeof transferProjectFormSchema>>({
    resolver: zodResolver(transferProjectFormSchema),
    defaultValues: {
      organization: '',
    },
  });

  useEffect(() => {
    if (session_id) {
      setOpen(true);
      setFinishOrgCreation(true);
      setPreventClose(true);
    }
  }, [session_id, setOpen]);

  useEffect(() => {
    if (isNotEmptyValue(newOrgSlug)) {
      const newOrg = orgs.find((org) => org.slug === newOrgSlug);
      if (newOrg) {
        form.setValue('organization', newOrg?.id, { shouldDirty: true });
      }
    }
  }, [newOrgSlug, orgs, form]);

  const createNewFormSelected = form.watch('organization') === CREATE_NEW_ORG;
  const submitButtonText = createNewFormSelected ? 'Continue' : 'Transfer';

  const path = asPath.split('?')[0];
  const redirectUrl = `${window.location.origin}${path}`;

  const handleCreateDialogOpenStateChange = (newState: boolean) => {
    setShowCreateOrgModal(newState);
    setOpen(true);
  };

  const onSubmit = async (
    values: z.infer<typeof transferProjectFormSchema>,
  ) => {
    const { organization } = values;

    if (organization === CREATE_NEW_ORG) {
      setShowCreateOrgModal(true);
      setOpen(false);
    } else {
      await execPromiseWithErrorToast(
        async () => {
          await transferProject({
            variables: {
              appID: project?.id,
              organizationID: organization,
            },
          });

          const targetOrg = orgs.find((o) => o.id === organization);
          await push(`/orgs/${targetOrg.slug}/projects`);
        },
        {
          loadingMessage: 'Transferring project...',
          successMessage: 'Project transferred successfully!',
          errorMessage: 'Error transferring project. Please try again.',
        },
      );
    }
  };

  const isUserAdminOfOrg = (org: Org, userId: string) =>
    org.members.some(
      (member) =>
        member.role === Organization_Members_Role_Enum.Admin &&
        member.user.id === userId,
    );

  const removeSessionIdFromQuery = () => {
    replace({ pathname, query: remainingQuery }, undefined, { shallow: true });
  };

  const handleFinishOrgCreationCompleted: FinishOrgCreationOnCompletedCb =
    async (data) => {
      const { Slug } = data;

      await refetchOrgs();
      setNewOrgSlug(Slug);
      setFinishOrgCreation(false);
      removeSessionIdFromQuery();
      setPreventClose(false);
    };

  const handleTransferProjectDialogOpenChange = (newValue: boolean) => {
    if (preventClose) {
      return;
    }
    if (!newValue) {
      setNewOrgSlug(undefined);
    }
    form.reset();
    setOpen(newValue);
  };

  if (projectLoading || orgsLoading) {
    return <LoadingScreen />;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleTransferProjectDialogOpenChange}>
        <DialogContent className="z-[9999] text-foreground sm:max-w-xl">
          <DialogHeader className="flex gap-2">
            <DialogTitle>
              Move the current project to a different organization.{' '}
            </DialogTitle>

            {!finishOrgCreation && (
              <DialogDescription>
                To transfer a project between organizations, you must be an{' '}
                <span className="font-bold">ADMIN</span> in both.
                <br />
                When transferred to a new organization, the project will adopt
                that organization’s plan.
              </DialogDescription>
            )}
          </DialogHeader>
          {finishOrgCreation ? (
            <FinishOrgCreation
              onCompleted={handleFinishOrgCreationCompleted}
              onError={() => setPreventClose(false)}
            />
          ) : (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={form.control}
                  name="organization"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Organization</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Organization" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {orgs.map((org) => (
                            <SelectItem
                              key={org.id}
                              value={org.id}
                              disabled={
                                org.plan.isFree || // disable the personal org
                                org.id === currentOrg.id || // disable the current org as it can't be a destination org
                                !isUserAdminOfOrg(org, currentUserId) // disable orgs that the current user is not admin of
                              }
                            >
                              {org.name}
                              <Badge
                                variant={
                                  org.plan.isFree ? 'outline' : 'default'
                                }
                                className={cn(
                                  org.plan.isFree ? 'bg-muted' : '',
                                  'hover:none ml-2 h-5 px-[6px] text-[10px]',
                                )}
                              >
                                {org.plan.name}
                              </Badge>
                            </SelectItem>
                          ))}
                          <SelectItem
                            key={CREATE_NEW_ORG}
                            value={CREATE_NEW_ORG}
                          >
                            <div className="flex items-center justify-center gap-2">
                              <Plus
                                className="h-4 w-4 font-bold"
                                strokeWidth={3}
                              />{' '}
                              <span>New Organization</span>
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="secondary"
                    type="button"
                    disabled={form.formState.isSubmitting || preventClose}
                    onClick={() => {
                      form.reset();
                      setOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      form.formState.isSubmitting || !form.formState.isDirty
                    }
                  >
                    {form.formState.isSubmitting ? (
                      <ActivityIndicator />
                    ) : (
                      submitButtonText
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
      <CreateOrgDialog
        hideNewOrgButton
        isOpen={showCreateOrgModal}
        onOpenStateChange={handleCreateDialogOpenStateChange}
        redirectUrl={redirectUrl}
      />
    </>
  );
}
