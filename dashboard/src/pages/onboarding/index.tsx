import { zodResolver } from '@hookform/resolvers/zod';
import { formatDistance } from 'date-fns';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Container } from '@/components/layout/Container';
import { StandaloneLayout } from '@/components/layout/StandaloneLayout';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
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
import { PlanCard } from '@/features/orgs/components/billing/PlanCard';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';
import { AuthGuard } from '@/features/orgs/guards/AuthGuard';
import { planDescriptions } from '@/features/orgs/projects/common/utils/planDescriptions';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useCreateOrganizationRequestMutation,
  useOrganizationMemberInviteAcceptMutation,
  useOrganizationMemberInvitesLazyQuery,
  usePrefetchNewAppQuery,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { useUserData } from '@/hooks/useUserData';
import { isNotEmptyValue } from '@/lib/utils';
import { ORGANIZATION_TYPES } from '@/utils/constants/organizationTypes';
import { errorMessageIncludes } from '@/utils/databaseErrors';

const onboardingSchema = z.object({
  organizationName: z
    .string()
    .min(2, 'Organization name must be at least 2 characters'),
  organizationType: z.string().min(1, 'Please select an organization type'),
  plan: z.string().min(1, 'Please select a plan'),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

export default function OnboardingPage() {
  const router = useRouter();
  const user = useUserData();
  const { orgs, loading: loadingOrgs, error: orgsError } = useOrgs();
  const { data: plansData, loading: loadingPlans } = usePrefetchNewAppQuery({
    skip: !user,
  });
  const [createOrganizationRequest] = useCreateOrganizationRequestMutation();
  const [stripeClientSecret, setStripeClientSecret] = useState('');

  const [
    getInvites,
    {
      loading: loadingInvites,
      data: { organizationMemberInvites: invites = [] } = {},
    },
  ] = useOrganizationMemberInvitesLazyQuery();

  const [acceptInvite] = useOrganizationMemberInviteAcceptMutation();
  const track = useTrackEvent();

  const [showOnboardingForm, setShowOnboardingForm] = useState(false);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      organizationName: '',
      organizationType: '',
      plan: '',
    },
  });

  // Enterprise is contact only and has its own row, so any Enterprise plan
  // coming back from the API (e.g. staging test plans) is left out here.
  const orderablePlans = useMemo(
    () =>
      (plansData?.plans ?? []).filter(
        (plan) => !plan.name.toLowerCase().startsWith('enterprise'),
      ),
    [plansData],
  );

  const selectedPlan = form.watch('plan');
  const selectedPlanData = plansData?.plans?.find(
    (plan) => plan.id === selectedPlan,
  );
  const isSelectedPlanPaid = selectedPlanData && !selectedPlanData.isFree;

  useEffect(() => {
    if (user?.id) {
      getInvites({
        variables: {
          userId: user.id,
        },
      });
    }
  }, [user?.id, getInvites]);

  useEffect(() => {
    if (!loadingOrgs && !orgsError && orgs && orgs.length > 0) {
      router.push('/');
    }
  }, [orgs, loadingOrgs, orgsError, router]);

  const onSubmit = async (data: OnboardingFormData) => {
    sessionStorage.setItem('onboarding', 'true');

    await execPromiseWithErrorToast(
      async () => {
        const redirectUrl = `${window.location.origin}/orgs/verify`;

        const response = await createOrganizationRequest({
          variables: {
            organizationName: data.organizationName,
            planID: data.plan,
            redirectURL: redirectUrl,
          },
        });

        if (isNotEmptyValue(response.data?.billingCreateOrganizationRequest)) {
          setStripeClientSecret(
            response.data?.billingCreateOrganizationRequest,
          );
        } else {
          router.push('/onboarding/project');
        }
      },
      {
        loadingMessage: 'Creating your organization...',
        successMessage: 'Organization created successfully!',
        errorMessage: (error) =>
          errorMessageIncludes(error, 'User already has a free organization')
            ? 'You already have a free organization. Upgrade it or delete it before creating another.'
            : 'Failed to create organization. Please try again.',
      },
    );
  };

  const handleAcceptInvite = async (invite: (typeof invites)[0]) => {
    await execPromiseWithErrorToast(
      async () => {
        await acceptInvite({
          variables: {
            inviteId: invite.id,
          },
        });
        track('Organization Invite Accepted', {
          org_slug: invite.organization?.slug,
        });

        await router.push(`/orgs/${invite?.organization?.slug}/projects`);
      },
      {
        loadingMessage: `Joining ${invite.organization.name}...`,
        successMessage: `Welcome to ${invite.organization.name}!`,
        errorMessage: `Failed to join organization. Please try again.`,
      },
    );
  };

  if (loadingOrgs || loadingPlans || loadingInvites) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (invites && invites.length > 0 && !showOnboardingForm) {
    return (
      <Container rootClassName="h-full">
        <div className="mx-auto max-w-2xl py-12">
          <div className="mb-8 text-center">
            <h2 className="mb-4 font-bold text-3xl">
              You&apos;ve been invited!
            </h2>
            <p className="text-lg text-muted-foreground">
              You have{' '}
              {invites.length === 1
                ? 'an invitation'
                : `${invites.length} invitations`}{' '}
              to join
              {invites.length === 1 ? ' an organization' : ' organizations'}
            </p>
          </div>

          <div className="space-y-4">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="rounded-lg border border-border p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="mb-2 font-semibold text-xl">
                      {invite.organization.name}
                    </h3>
                    <p className="text-muted-foreground">
                      Join as {invite.role.toLowerCase()}
                    </p>
                    <p className="mt-1 text-muted-foreground text-sm">
                      Invited{' '}
                      {formatDistance(new Date(invite.createdAt), new Date(), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <div className="ml-6">
                    <Button
                      onClick={() => handleAcceptInvite(invite)}
                      className="min-w-[120px]"
                    >
                      Join Organization
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="mb-4 text-muted-foreground text-sm">
              Don&apos;t want to join? You can create your own organization
              instead.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowOnboardingForm(true)}
            >
              Create New Organization
            </Button>
          </div>
        </div>
      </Container>
    );
  }

  if (stripeClientSecret) {
    return (
      <Container className="mx-auto max-w-2xl py-12">
        <div className="mb-8 flex items-center justify-center">
          <div className="flex items-center space-x-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 font-medium text-sm text-white">
              ✓
            </div>
            <div className="h-1 w-16 bg-green-500" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
              2
            </div>
            <div className="h-1 w-16 bg-muted" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-sm">
              3
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-white p-6 shadow-sm">
          <div className="mb-6 text-center">
            <h2 className="mb-2 font-bold text-2xl text-black">
              Complete Payment
            </h2>
            <p className="text-gray-600">
              Complete your payment to create your organization
            </p>
          </div>

          <StripeEmbeddedForm clientSecret={stripeClientSecret} />
        </div>
      </Container>
    );
  }

  return (
    <Container className="mx-auto max-w-2xl py-12">
      <div className="mb-8 flex items-center justify-center">
        <div className="flex items-center space-x-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary font-medium text-primary-foreground text-sm">
            1
          </div>
          <div className="h-1 w-16 bg-muted" />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-sm">
            2
          </div>
          {isSelectedPlanPaid && (
            <>
              <div className="h-1 w-16 bg-muted" />
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground text-sm">
                3
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border p-6 shadow-sm">
        <div className="mb-6 text-center">
          <h2 className="mb-2 font-bold text-2xl">Welcome to Nhost!</h2>
          <p className="text-muted-foreground">
            Let&apos;s create your organization to get started
          </p>
        </div>
        <div>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Inc" autoFocus {...field} />
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
                    <FormLabel>
                      What would best describe your organization?
                    </FormLabel>
                    <Select
                      onValueChange={(value) => {
                        field.onChange(value);
                        localStorage.setItem(
                          'metadata',
                          JSON.stringify({ organizationType: value }),
                        );
                      }}
                      value={field.value}
                    >
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
                    <FormLabel>Choose your plan</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="flex flex-col gap-3 rounded-xl border bg-muted/40 p-3"
                      >
                        {orderablePlans.map((plan) => (
                          <FormItem key={plan.id}>
                            <PlanCard
                              compact
                              value={plan.id}
                              name={plan.name}
                              price={plan.isFree ? 'Free' : `$${plan.price}`}
                              isMonthly={!plan.isFree}
                              description={planDescriptions[plan.name]}
                              isSelected={field.value === plan.id}
                            />
                          </FormItem>
                        ))}
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

              <div className="flex flex-col justify-end gap-3 sm:flex-row">
                {invites && invites.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowOnboardingForm(false)}
                    className="w-full sm:w-auto"
                  >
                    ← Back to Invites
                  </Button>
                )}

                <ButtonWithLoading
                  type="submit"
                  disabled={!selectedPlan}
                  loading={form.formState.isSubmitting}
                  className="w-full sm:w-auto"
                >
                  {form.formState.isSubmitting
                    ? 'Creating Organization...'
                    : 'Create Organization'}
                </ButtonWithLoading>
              </div>

              {invites && invites.length > 0 && (
                <Alert className="mt-4">
                  <AlertDescription>
                    <span className="font-medium text-primary">
                      💡 Pending Invitation{invites.length > 1 ? 's' : ''}
                    </span>
                    <br />
                    <span className="mt-1.5 block text-gray-600 text-sm dark:text-gray-400">
                      You have {invites.length} pending invitation
                      {invites.length > 1 ? 's' : ''} to join existing
                      organization{invites.length > 1 ? 's' : ''}. You can
                      accept {invites.length > 1 ? 'them' : 'it'} instead of
                      creating a new organization.
                    </span>
                  </AlertDescription>
                </Alert>
              )}
            </form>
          </Form>
        </div>
      </div>
    </Container>
  );
}

OnboardingPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <StandaloneLayout title="Onboarding - Welcome to Nhost">
      <AuthGuard>{page}</AuthGuard>
    </StandaloneLayout>
  );
};
