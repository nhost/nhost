import { Link } from '@/components/ui/v2/Link';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useUserData } from '@/hooks/useUserData';
import { analytics } from '@/lib/segment';

import { useRouter } from 'next/router';

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';

import { useUI } from '@/components/common/UIProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { planDescriptions } from '@/features/orgs/projects/common/utils/planDescriptions';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import {
  useCreateOrganizationRequestMutation,
  usePrefetchNewAppQuery,
  type PrefetchNewAppPlansFragment,
} from '@/utils/__generated__/graphql';
import { ORGANIZATION_TYPES } from '@/utils/constants/organizationTypes';
import { zodResolver } from '@hookform/resolvers/zod';
import { DialogDescription } from '@radix-ui/react-dialog';
import { Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const createOrgFormSchema = z.object({
  name: z.string().min(2),
  organizationType: z.string().min(1, 'Please select an organization type'),
  plan: z.optional(z.string()),
});

interface CreateOrgFormProps {
  plans: PrefetchNewAppPlansFragment[];
  onSubmit?: ({
    name,
    plan,
  }: z.infer<typeof createOrgFormSchema>) => Promise<void>;
  onCancel: () => void;
}

function CreateOrgForm({ plans, onSubmit, onCancel }: CreateOrgFormProps) {
  const { orgs } = useOrgs();
  const starterPlan = plans.find(({ name }) => name === 'Starter');
  const proPlan = plans.find(({ name }) => name === 'Pro')!;

  // Check if user already has a starter organization
  const hasStarterOrg = orgs.some(
    (org) => org.plan.name === 'Starter' || org.plan.isFree,
  );

  // Default to starter plan if user doesn't have one, otherwise default to pro
  const defaultPlan =
    !hasStarterOrg && starterPlan ? starterPlan.id : proPlan?.id || '';

  const form = useForm<z.infer<typeof createOrgFormSchema>>({
    resolver: zodResolver(createOrgFormSchema),
    defaultValues: {
      name: '',
      plan: defaultPlan,
      organizationType: '',
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name</FormLabel>
              <FormControl>
                <Input placeholder="Acme Inc" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organizationType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What would best describe your organization?</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {ORGANIZATION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="plan"
          render={({ field }) => (
            <FormItem className="">
              <div>
                <FormLabel>Plan</FormLabel>
                <FormDescription className="text-xs">
                  You can change this later
                </FormDescription>
              </div>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  {plans.map((plan) => {
                    const isStarterPlan =
                      plan.name === 'Starter' || plan.isFree;
                    const isDisabled = isStarterPlan && hasStarterOrg;

                    const labelContent = (
                      <FormLabel
                        className={cn(
                          'flex w-full cursor-pointer flex-row items-center justify-between space-y-0 rounded-md border p-3',
                          isDisabled && 'cursor-not-allowed opacity-50',
                        )}
                      >
                        <div className="flex flex-row items-center space-x-3">
                          <FormControl>
                            <RadioGroupItem
                              value={plan.id}
                              disabled={isDisabled}
                            />
                          </FormControl>
                          <div className="flex flex-col space-y-2">
                            <div className="text-md font-semibold">
                              {plan.name}
                            </div>
                            <FormDescription className="w-2/3 text-xs">
                              {planDescriptions[plan.name]}
                            </FormDescription>
                          </div>
                        </div>

                        <div className="mt-0 flex h-full items-center text-xl font-semibold">
                          {plan.isFree ? 'Free' : `$${plan.price}/mo`}
                        </div>
                      </FormLabel>
                    );

                    return (
                      <FormItem key={plan.id}>
                        {isDisabled ? (
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>
                              {labelContent}
                            </TooltipTrigger>
                            <TooltipContent>
                              You can only have one Starter organization
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          labelContent
                        )}
                      </FormItem>
                    );
                  })}
                  <div>
                    <div className="flex w-full cursor-pointer flex-row items-center justify-between space-y-0 rounded-md border p-3">
                      <div className="flex flex-row items-center space-x-3">
                        <div className="flex flex-col space-y-2">
                          <div className="text-md font-semibold">
                            Enterprise
                          </div>
                          <div className="w-2/3 text-xs">
                            {planDescriptions.Enterprise}
                          </div>
                        </div>
                      </div>

                      <Link
                        href="mailto:hello@nhost.io"
                        target="_blank"
                        rel="noopener noreferrer"
                        underline="hover"
                        className="font-medium"
                      >
                        Contact us
                        <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button
            variant="secondary"
            type="button"
            disabled={form.formState.isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <ActivityIndicator />
            ) : (
              'Create organization'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

interface CreateOrgDialogProps {
  hideNewOrgButton?: boolean;
  isOpen?: boolean;
  onOpenStateChange?: (newState: boolean) => void;
  redirectUrl?: string;
}

function isPropSet(prop: any) {
  return prop !== undefined;
}

export default function CreateOrgDialog({
  hideNewOrgButton,
  isOpen,
  onOpenStateChange,
  redirectUrl,
}: CreateOrgDialogProps) {
  const router = useRouter();
  const currentUser = useUserData();
  const { maintenanceActive } = useUI();
  const user = useUserData();
  const isPlatform = useIsPlatform();
  const [open, setOpen] = useState(false);
  const { data, loading, error } = usePrefetchNewAppQuery({
    skip: !user || !isPlatform,
  });
  const [createOrganizationRequest] = useCreateOrganizationRequestMutation();
  const [stripeClientSecret, setStripeClientSecret] = useState('');
  const { refetch: refetchOrgs } = useOrgs();

  const handleOpenChange = (newOpenState: boolean) => {
    const controlledFromOutSide =
      isPropSet(isOpen) && isPropSet(onOpenStateChange);
    if (controlledFromOutSide) {
      onOpenStateChange(newOpenState);
    } else {
      setOpen(newOpenState);
    }
  };

  const createOrg = async ({
    name,
    organizationType,
    plan,
  }: {
    name?: string;
    organizationType?: string;
    plan?: string;
  }) => {
    await execPromiseWithErrorToast(
      async () => {
        const defaultRedirectUrl = `${window.location.origin}/orgs/verify`;

        const {
          data: { billingCreateOrganizationRequest: clientSecret },
        } = await createOrganizationRequest({
          variables: {
            organizationName: name,
            planID: plan,
            redirectURL: redirectUrl ?? defaultRedirectUrl,
          },
        });

        if (clientSecret) {
          setStripeClientSecret(clientSecret);
        } else {
          const {
            data: { organizations },
          } = await refetchOrgs();

          const newOrg = organizations.find((org) => org.plan.isFree);

          analytics.track('Organization Created', {
            organizationId: newOrg.id,
            organizationSlug: newOrg.slug,
            organizationName: name,
            organizationPlan: newOrg.plan.name,
            organizationOwnerId: currentUser?.id,
            organizationOwnerEmail: currentUser?.email,
            organizationMetadata: {
              organizationType,
            },
            isOnboarding: false,
          });

          router.push(`/orgs/${newOrg.slug}/projects`);
          handleOpenChange(false);
        }
      },
      {
        loadingMessage: 'Redirecting to checkout',
        successMessage: 'Success',
        errorMessage: 'An error occurred while redirecting to checkout!',
      },
    );
  };

  if (error) {
    throw error;
  }

  if (!isPlatform) {
    return null;
  }

  return (
    <Dialog open={isOpen ?? open} onOpenChange={handleOpenChange}>
      {!hideNewOrgButton && (
        <DialogTrigger asChild>
          <Button
            disabled={maintenanceActive}
            className={cn(
              'flex h-8 w-full flex-row justify-start gap-3 px-2',
              'bg-background text-foreground hover:bg-accent dark:hover:bg-muted',
            )}
            onClick={() => setStripeClientSecret('')}
          >
            <Plus className="h-4 w-4 font-bold" strokeWidth={3} />
            New Organization
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className={cn(
          'text-foreground sm:max-w-xl',
          !loading && stripeClientSecret ? 'bg-white text-black' : '',
        )}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>New Organization</DialogTitle>
          <DialogDescription />
        </DialogHeader>

        {loading && (
          <div className="flex h-52 items-center justify-center">
            <ActivityIndicator
              circularProgressProps={{
                className: 'w-5 h-5',
              }}
            />
          </div>
        )}
        {!loading && !stripeClientSecret && (
          <CreateOrgForm
            plans={data?.plans}
            onSubmit={createOrg}
            onCancel={() => handleOpenChange(false)}
          />
        )}
        {!loading && stripeClientSecret && (
          <StripeEmbeddedForm clientSecret={stripeClientSecret} />
        )}
      </DialogContent>
    </Dialog>
  );
}
