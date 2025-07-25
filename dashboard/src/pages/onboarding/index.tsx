import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Container } from '@/components/layout/Container';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { Button } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';
import { planDescriptions } from '@/features/orgs/projects/common/utils/planDescriptions';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUserData } from '@/hooks/useUserData';
import {
  useCreateOrganizationRequestMutation,
  useOrganizationMemberInviteAcceptMutation,
  useOrganizationMemberInvitesLazyQuery,
  usePrefetchNewAppQuery,
} from '@/utils/__generated__/graphql';
import { ORGANIZATION_TYPES } from '@/utils/constants/organizationTypes';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDistance } from 'date-fns';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
  const { orgs, loading: loadingOrgs } = useOrgs();
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
  
  const [showOnboardingForm, setShowOnboardingForm] = useState(false);

  const form = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      organizationName: '',
      organizationType: '',
      plan: '',
    },
  });

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
    if (!loadingOrgs && orgs && orgs.length > 0) {
      router.push('/');
    }
  }, [orgs, loadingOrgs, router]);

  useEffect(() => {
    if (plansData?.plans?.length > 0 && !form.getValues('plan')) {
      form.setValue('plan', plansData.plans[0].id);
    }
  }, [plansData, form]);

  const onSubmit = async (data: OnboardingFormData) => {
    sessionStorage.setItem('onboarding', 'true');

    await execPromiseWithErrorToast(
      async () => {
        const redirectUrl = `${window.location.origin}/orgs/verify`;

        const {
          data: { billingCreateOrganizationRequest: clientSecret },
        } = await createOrganizationRequest({
          variables: {
            organizationName: data.organizationName,
            planID: data.plan,
            redirectURL: redirectUrl,
          },
        });

        if (clientSecret) {
          setStripeClientSecret(clientSecret);
        } else {
          router.push('/onboarding/project');
        }
      },
      {
        loadingMessage: 'Creating your organization...',
        successMessage: 'Organization created successfully!',
        errorMessage: 'Failed to create organization. Please try again.',
      },
    );
  };

  const handleAcceptInvite = async (invite: typeof invites[0]) => {
    await execPromiseWithErrorToast(
      async () => {
        await acceptInvite({
          variables: {
            inviteId: invite.id,
          },
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
        <ActivityIndicator />
      </div>
    );
  }

  if (invites && invites.length > 0 && !showOnboardingForm) {
    return (
      <Container rootClassName="h-full">
        <div className="mx-auto max-w-2xl py-12">
          <div className="mb-8 text-center">
            <Text variant="h2" className="mb-4 text-3xl font-bold">
              You&apos;ve been invited!
            </Text>
            <Text className="text-muted-foreground text-lg">
              You have {invites.length === 1 ? 'an invitation' : `${invites.length} invitations`} to join 
              {invites.length === 1 ? ' an organization' : ' organizations'}
            </Text>
          </div>

          <div className="space-y-4">
            {invites.map((invite) => (
              <Box
                key={invite.id}
                className="rounded-lg border border-border bg-card p-6 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <Text variant="h3" className="mb-2 text-xl font-semibold">
                      {invite.organization.name}
                    </Text>
                    <Text className="text-muted-foreground">
                      Join as {invite.role.toLowerCase()}
                    </Text>
                    <Text className="text-sm text-muted-foreground mt-1">
                      Invited {formatDistance(new Date(invite.createdAt), new Date(), { addSuffix: true })}
                    </Text>  
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
              </Box>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Text className="text-sm text-muted-foreground mb-4">
              Don&apos;t want to join? You can create your own organization instead.
            </Text>
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
      <div className="mx-auto max-w-2xl py-12">
        <div className="mb-8 flex items-center justify-center">
          <div className="flex items-center space-x-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              1
            </div>
            <div className="h-1 w-16 bg-muted" />
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
              2
            </div>
          </div>
        </div>

        <Box className="rounded-lg border border-border bg-white p-6 shadow-sm">
          <div className="mb-6 text-center">
            <Text variant="h2" className="mb-2 text-2xl font-bold text-black">
              Complete Payment
            </Text>
            <Text className="text-gray-600">
              Complete your payment to create your organization
            </Text>
          </div>

          <StripeEmbeddedForm clientSecret={stripeClientSecret} />
        </Box>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-12">
      <div className="mb-8 flex items-center justify-center">
        <div className="flex items-center space-x-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            1
          </div>
          <div className="h-1 w-16 bg-muted" />
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
            2
          </div>
        </div>
      </div>

      <Box className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-6 text-center">
          <Text variant="h2" className="mb-2 text-2xl font-bold">
            Welcome to Nhost!
          </Text>
          <Text className="text-muted-foreground">
            Let&apos;s create your organization to get started
          </Text>
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
                    <FormDescription>You can change this later</FormDescription>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        value={field.value}
                        className="space-y-3"
                      >
                        {plansData?.plans?.map((plan) => (
                          <FormItem key={plan.id}>
                            <FormLabel className="flex w-full cursor-pointer items-center justify-between rounded-lg border p-4 hover:bg-accent">
                              <div className="flex items-center space-x-3">
                                <FormControl>
                                  <RadioGroupItem value={plan.id} />
                                </FormControl>
                                <div>
                                  <div className="font-medium">{plan.name}</div>
                                  <div className="text-sm text-muted-foreground">
                                    {planDescriptions[plan.name]}
                                  </div>
                                </div>
                              </div>
                              <div className="text-lg font-semibold">
                                {plan.isFree ? 'Free' : `$${plan.price}/mo`}
                              </div>
                            </FormLabel>
                          </FormItem>
                        ))}
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
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
                
                <Button
                  type="submit"
                  disabled={form.formState.isSubmitting}
                  className="w-full sm:w-auto"
                >
                  {form.formState.isSubmitting ? (
                    <>
                      <ActivityIndicator className="mr-2 h-4 w-4" />
                      Creating Organization...
                    </>
                  ) : (
                    'Create Organization'
                  )}
                </Button>
              </div>

              {invites && invites.length > 0 && (
                <Alert
                  severity="info"
                  className="bg-primary/8 mt-4 rounded-lg border border-primary/20"
                >
                  <Text className="text-sm">
                    <span className="font-medium text-primary">
                      💡 Pending Invitation{invites.length > 1 ? 's' : ''}
                    </span>
                    <br />
                    <span className="mt-1.5 block text-sm text-gray-600 dark:text-gray-400">
                      You have {invites.length} pending invitation{invites.length > 1 ? 's' : ''} to join existing organization{invites.length > 1 ? 's' : ''}. 
                      You can accept {invites.length > 1 ? 'them' : 'it'} instead of creating a new organization.
                    </span>
                  </Text>
                </Alert>
              )}
            </form>
          </Form>
        </div>
      </Box>
    </div>
  );
}

OnboardingPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout
      title="Onboarding - Welcome to Nhost"
      withMainNav={false}
    >
      {page}
    </AuthenticatedLayout>
  );
};
