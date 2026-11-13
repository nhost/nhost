import { zodResolver } from '@hookform/resolvers/zod';
import { DialogDescription } from '@radix-ui/react-dialog';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { RadioGroup } from '@/components/ui/v3/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { TextLink } from '@/components/ui/v3/text-link';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { PlanCard } from '@/features/orgs/components/billing/PlanCard';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { planDescriptions } from '@/features/orgs/projects/common/utils/planDescriptions';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  type PrefetchNewAppPlansFragment,
  useCreateOrganizationRequestMutation,
  usePrefetchNewAppQuery,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { analytics } from '@/lib/segment';
import { cn } from '@/lib/utils';
import { ORGANIZATION_TYPES } from '@/utils/constants/organizationTypes';
import { errorMessageIncludes } from '@/utils/databaseErrors';

const createOrgFormSchema = z.object({
  name: z.string().min(2),
  organizationType: z.string().min(1, 'Please select an organization type'),
  plan: z.string(),
});

interface CreateOrgFormProps {
  plans: PrefetchNewAppPlansFragment[];
  onSubmit: ({
    name,
    plan,
  }: z.infer<typeof createOrgFormSchema>) => Promise<void>;
  onCancel: () => void;
  isStarterDisabled?: boolean;
}

function CreateOrgForm({
  plans,
  onSubmit,
  onCancel,
  isStarterDisabled,
}: CreateOrgFormProps) {
  const { orgs } = useOrgs();
  // Enterprise is contact only and has its own row, so any Enterprise plan
  // coming back from the API (e.g. staging test plans) is left out here.
  const orderablePlans = plans.filter(
    (plan) => !plan.name.toLowerCase().startsWith('enterprise'),
  );
  const starterPlan = plans.find(({ name }) => name === 'Starter');
  const proPlan = plans.find(({ name }) => name === 'Pro')!;

  const hasStarterOrg = orgs.some(
    (org) => org.plan.name === 'Starter' || org.plan.isFree,
  );

  const defaultPlan =
    !hasStarterOrg && starterPlan && !isStarterDisabled
      ? starterPlan.id
      : proPlan?.id || '';

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
            <FormItem>
              <FormLabel className="sr-only">Plan</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-3"
                >
                  {orderablePlans.map((plan) => {
                    const isStarterPlan =
                      plan.name === 'Starter' || plan.isFree;
                    const isDisabled =
                      isStarterPlan && (hasStarterOrg || isStarterDisabled);

                    const card = (
                      <PlanCard
                        compact
                        value={plan.id}
                        name={plan.name}
                        price={plan.isFree ? 'Free' : `$${plan.price}`}
                        isMonthly={!plan.isFree}
                        description={planDescriptions[plan.name]}
                        isSelected={field.value === plan.id}
                        isPopular={plan.name === 'Team'}
                        disabled={isDisabled}
                        className={cn({ 'opacity-50': isDisabled })}
                      />
                    );

                    return (
                      <FormItem key={plan.id}>
                        {isDisabled ? (
                          <Tooltip delayDuration={100}>
                            <TooltipTrigger asChild>{card}</TooltipTrigger>
                            <TooltipContent>
                              You can only have one Starter organization
                            </TooltipContent>
                          </Tooltip>
                        ) : (
                          card
                        )}
                      </FormItem>
                    );
                  })}
                  <PlanCard
                    compact
                    name="Enterprise"
                    description={planDescriptions.Enterprise}
                  >
                    <TextLink
                      href="mailto:hello@nhost.io"
                      external
                      className="shrink-0 font-medium"
                    >
                      Contact us
                    </TextLink>
                  </PlanCard>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-8">
          <Button
            variant="outline"
            type="button"
            disabled={form.formState.isSubmitting}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <ButtonWithLoading
            type="submit"
            loading={form.formState.isSubmitting}
          >
            Create organization
          </ButtonWithLoading>
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
  isStarterDisabled?: boolean;
}

function isPropSet<T>(prop: T): prop is Exclude<T, undefined | null> {
  return prop !== undefined;
}

export default function CreateOrgDialog({
  hideNewOrgButton,
  isOpen,
  onOpenStateChange,
  redirectUrl,
  isStarterDisabled = false,
}: CreateOrgDialogProps) {
  const router = useRouter();
  const currentUser = useUserData();
  const user = useUserData();
  const isPlatform = useIsPlatform();
  const [open, setOpen] = useState(false);
  const isDialogOpen = isOpen ?? open;
  // The header keeps this dialog mounted, so only fetch once it is opened.
  const { data, loading, error } = usePrefetchNewAppQuery({
    skip: !user || !isPlatform || !isDialogOpen,
  });
  const [createOrganizationRequest] = useCreateOrganizationRequestMutation({
    // Lets the inbox offer to continue the checkout if this dialog is closed
    // before paying.
    refetchQueries: ['organizationNewRequests'],
  });
  const [stripeClientSecret, setStripeClientSecret] = useState('');
  const { refetch: refetchOrgs } = useOrgs();

  // Reopening starts a new organization; an abandoned checkout is resumed from
  // the inbox instead. The secret is cleared on open rather than on close, so
  // the checkout stays visible while the dialog animates out. Controlled opens
  // bypass `handleOpenChange`, so this follows the open state itself.
  const [wasDialogOpen, setWasDialogOpen] = useState(isDialogOpen);
  if (isDialogOpen !== wasDialogOpen) {
    setWasDialogOpen(isDialogOpen);
    if (isDialogOpen) {
      setStripeClientSecret('');
    }
  }

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
    name: string;
    organizationType: string;
    plan: string;
  }) => {
    await execPromiseWithErrorToast(
      async () => {
        const defaultRedirectUrl = `${window.location.origin}/orgs/verify`;

        const response = await createOrganizationRequest({
          variables: {
            organizationName: name,
            planID: plan,
            redirectURL: redirectUrl ?? defaultRedirectUrl,
          },
        });

        if (response.data?.billingCreateOrganizationRequest) {
          setStripeClientSecret(
            response.data?.billingCreateOrganizationRequest,
          );
        } else {
          const {
            data: { organizations },
          } = await refetchOrgs();

          const newOrg = organizations.find((org) => org.plan.isFree);

          analytics.track('Organization Created', {
            organizationId: newOrg?.id,
            organizationSlug: newOrg?.slug,
            organizationName: name,
            organizationPlan: newOrg?.plan.name,
            organizationOwnerId: currentUser?.id,
            organizationOwnerEmail: currentUser?.email,
            organizationMetadata: {
              organizationType,
            },
            isOnboarding: false,
          });

          router.push(`/orgs/${newOrg?.slug}/projects`);
          handleOpenChange(false);
        }
      },
      {
        loadingMessage: 'Redirecting to checkout',
        successMessage: 'Success',
        errorMessage: (mutationError) =>
          errorMessageIncludes(
            mutationError,
            'User already has a free organization',
          )
            ? 'You already have a free organization. Upgrade it or delete it before creating another.'
            : 'An error occurred while creating the organization. Please try again.',
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
    <Dialog open={isDialogOpen} onOpenChange={handleOpenChange}>
      {!hideNewOrgButton && (
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            className="flex h-8 w-full flex-row justify-start gap-3 px-2 text-foreground dark:hover:bg-muted"
          >
            <Plus className="h-4 w-4 font-bold" strokeWidth={3} />
            New Organization
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className={cn(
          'text-foreground sm:max-w-xl',
          !loading && stripeClientSecret ? 'bg-white text-black' : 'p-12',
        )}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl leading-7 tracking-normal">
            New Organization
          </DialogTitle>
          <DialogDescription />
        </DialogHeader>

        {loading && (
          <div className="flex h-52 items-center justify-center">
            <Spinner className="h-5 w-5" />
          </div>
        )}
        {data && !loading && !stripeClientSecret && (
          <CreateOrgForm
            plans={data.plans}
            onSubmit={createOrg}
            onCancel={() => handleOpenChange(false)}
            isStarterDisabled={isStarterDisabled}
          />
        )}
        {!loading && stripeClientSecret && (
          <StripeEmbeddedForm clientSecret={stripeClientSecret} />
        )}
      </DialogContent>
    </Dialog>
  );
}
