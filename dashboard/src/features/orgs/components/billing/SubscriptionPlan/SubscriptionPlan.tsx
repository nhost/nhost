import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowUpRight, Slash } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@/components/ui/v3/form';
import { RadioGroup } from '@/components/ui/v3/radio-group';
import { TextLink } from '@/components/ui/v3/text-link';
import { FinishUpgradeOrganizationProcess } from '@/features/orgs/components/billing/FinishUpgradeOrganizationProcess';
import { PlanCard } from '@/features/orgs/components/billing/PlanCard';
import { StripeEmbeddedForm } from '@/features/orgs/components/StripeEmbeddedForm';
import { planDescriptions } from '@/features/orgs/projects/common/utils/planDescriptions';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useBillingChangeOrganizationPlanMutation,
  useBillingOrganizationCustomePortalLazyQuery,
  useBillingUpgradeFreeOrganizationMutation,
  useGetOrganizationPlansQuery,
} from '@/generated/graphql';
import { useRemoveQueryParamsFromUrl } from '@/hooks/useRemoveQueryParamsFromUrl';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { cn } from '@/lib/utils';

const changeOrgPlanForm = z.object({
  plan: z.string(),
});

/**
 * Feature highlights shown on each plan card in the upgrade dialog.
 * Purely presentational copy, keyed by plan name.
 */
const PLAN_HIGHLIGHTS: Record<string, string[]> = {
  Starter: [
    '1 GB database, 1 GB storage',
    '5 GB egress',
    'Functions, realtime APIs',
    'Community support',
  ],
  Pro: [
    '10 GB database, 50 GB storage',
    'Automated backups',
    'Point in time recovery',
    'Email support',
  ],
  Team: [
    'SOC 2 Type II',
    'Email support SLA',
    'Advanced GraphQL features',
    'HIPAA (coming soon)',
  ],
  Enterprise: [
    'Everything in Team plus:',
    'SLAs, dedicated technical account manager',
    'Dedicated clusters (add-on)',
  ],
};

const POPULAR_PLAN_NAME = 'Team';

/** Tier order used to auto-select the next plan up from the org's current one. */
const PLAN_ORDER = ['Starter', 'Pro', 'Team', 'Enterprise'];

/** Sentinel form value for the contact-only Enterprise tier (not a real plan id). */
const ENTERPRISE_PLAN_VALUE = 'enterprise';

export default function SubscriptionPlan() {
  const { org, refetch: refetchOrg } = useCurrentOrg();
  const track = useTrackEvent();
  const [open, setOpen] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState('');
  const [changeOrgPlan] = useBillingChangeOrganizationPlanMutation();
  const [updateFreeOrg] = useBillingUpgradeFreeOrganizationMutation();
  const { data: { plans = [] } = {} } = useGetOrganizationPlansQuery();
  const [fetchOrganizationCustomePortalLink, { loading }] =
    useBillingOrganizationCustomePortalLazyQuery();
  const { asPath, query, isReady } = useRouter();
  const { openUpgradeModal } = query;

  const isFreeOrg = org?.plan.isFree;
  const removeQueryParamsFromUrl = useRemoveQueryParamsFromUrl();

  // Real, purchasable plans only. The Enterprise tier is contact only and is
  // rendered as its own card further down, so any Enterprise-ish plan coming
  // back from the API (e.g. staging test plans) is excluded here.
  const orderablePlans = useMemo(
    () =>
      plans.filter((plan) => !plan.name.toLowerCase().startsWith('enterprise')),
    [plans],
  );

  const form = useForm<z.infer<typeof changeOrgPlanForm>>({
    resolver: zodResolver(changeOrgPlanForm),
    defaultValues: {
      plan: '',
    },
  });

  const hasSetDefaultPlan = useRef(false);

  // Preselect the next tier up each time the dialog opens.
  useEffect(() => {
    if (!open) {
      hasSetDefaultPlan.current = false;
      return;
    }

    if (hasSetDefaultPlan.current || !org || orderablePlans.length === 0) {
      return;
    }

    hasSetDefaultPlan.current = true;

    const currentIndex = PLAN_ORDER.indexOf(org.plan.name);
    const nextTierName =
      currentIndex === -1 ? null : PLAN_ORDER[currentIndex + 1];

    if (!nextTierName) {
      form.setValue('plan', org.plan.id, { shouldDirty: false });
    } else if (nextTierName === 'Enterprise') {
      form.setValue('plan', ENTERPRISE_PLAN_VALUE, { shouldDirty: false });
    } else {
      const nextPlan = orderablePlans.find(
        (plan) => plan.name === nextTierName,
      );
      form.setValue('plan', nextPlan ? nextPlan.id : org.plan.id, {
        shouldDirty: false,
      });
    }
  }, [open, org, orderablePlans, form]);

  useEffect(() => {
    if (isReady && openUpgradeModal) {
      setOpen(true);
      removeQueryParamsFromUrl('openUpgradeModal');
    }
  }, [openUpgradeModal, isReady, removeQueryParamsFromUrl]);

  const selectedPlanId = form.watch('plan');
  const isEnterpriseSelected = selectedPlanId === ENTERPRISE_PLAN_VALUE;
  const isEnterpriseCurrent = Boolean(
    org?.plan?.name?.toLowerCase().startsWith('enterprise'),
  );
  const selectedPlan = useMemo(
    () => orderablePlans.find((plan) => plan.id === selectedPlanId),
    [orderablePlans, selectedPlanId],
  );

  const submitLabel = useMemo(() => {
    if (isEnterpriseSelected) {
      return 'Contact sales';
    }

    if (!selectedPlan) {
      return 'Upgrade';
    }

    const isDowngrade =
      selectedPlan.isFree ||
      (org?.plan?.price !== undefined && selectedPlan.price < org.plan.price);
    const action = isDowngrade ? 'Downgrade' : 'Upgrade';
    const price = !selectedPlan.isFree ? `, $${selectedPlan.price}/mo` : '';

    return `${action} to ${selectedPlan.name}${price}`;
  }, [isEnterpriseSelected, selectedPlan, org?.plan?.price]);

  const onSubmit = async (values: z.infer<typeof changeOrgPlanForm>) => {
    const { plan: planID } = values;

    if (planID === ENTERPRISE_PLAN_VALUE) {
      window.location.href = 'mailto:hello@nhost.io';
      return;
    }

    const { id: organizationID, plan } = org;

    if (plan.isFree) {
      const path = asPath.split('?')[0];
      const redirectURL =
        typeof window !== 'undefined' ? `${window.location.origin}${path}` : '';

      const result = await updateFreeOrg({
        variables: {
          organizationID,
          planID,
          redirectURL,
        },
      });
      const clientSecret = result!.data!.billingUpgradeFreeOrganization!;
      setStripeClientSecret(clientSecret);
    } else {
      await execPromiseWithErrorToast(
        async () => {
          await changeOrgPlan({
            variables: {
              organizationID,
              planID,
            },
          });

          const newPlan = plans.find((p) => p.id === planID);
          track('Plan Changed', {
            from_plan: plan.name,
            to_plan: newPlan?.name,
          });

          await refetchOrg();
          form.reset({ plan: planID });
          setOpen(false);
        },
        {
          loadingMessage: 'Upgrading organization plan',
          successMessage: 'Organization plan was upgraded successfully',
          errorMessage:
            'An error occurred while upgrading the organization plan! Please try again',
        },
      );
    }
  };

  const handleUpdatePaymentDetails = async () => {
    const { id: organizationID } = org;
    await execPromiseWithErrorToast(
      async () => {
        const { data: { billingOrganizationCustomePortal = null } = {} } =
          await fetchOrganizationCustomePortalLink({
            variables: {
              organizationID,
            },
          });

        if (billingOrganizationCustomePortal) {
          const newWindow = window.open(billingOrganizationCustomePortal);
          if (!newWindow) {
            window.location.href = billingOrganizationCustomePortal;
          }
        } else {
          throw new Error('Could not fetch customer portal link');
        }
      },
      {
        loadingMessage: 'Processing',
        successMessage: 'Redirecting to customer portal',
        errorMessage:
          'An error occurred while redirecting to customer portal! Please try again',
      },
    );
  };

  const planOptions = useMemo(
    () =>
      orderablePlans.map((plan) => (
        <FormItem key={plan.id}>
          <PlanCard
            value={plan.id}
            name={plan.name}
            price={plan.isFree ? 'Free' : `$${plan.price}`}
            isMonthly={!plan.isFree}
            description={planDescriptions[plan.name]}
            highlights={PLAN_HIGHLIGHTS[plan.name]}
            isSelected={selectedPlanId === plan.id}
            isCurrent={org?.plan?.id === plan.id}
            isPopular={plan.name === POPULAR_PLAN_NAME}
            disabled={
              plan.isFree ||
              plan.name === 'Starter' ||
              org?.plan?.id === plan.id
            }
          >
            {plan.isFree && !isFreeOrg && (
              <p className="mt-4 text-muted-foreground text-xs">
                Downgrading is not available. To move to Starter, transfer your
                projects to a Starter organization and cancel this organization.
                See{' '}
                <TextLink
                  href="https://docs.nhost.io/platform/cloud/billing#downgrading-to-starter"
                  external
                >
                  documentation
                </TextLink>{' '}
                for details.
              </p>
            )}
          </PlanCard>
        </FormItem>
      )),
    [orderablePlans, isFreeOrg, org?.plan?.id, selectedPlanId],
  );

  return (
    <>
      <div>
        <div className="flex w-full flex-col rounded-md border bg-background">
          <div className="flex w-full flex-col gap-1 border-b p-4">
            <h4 className="font-medium">Subscription plan</h4>
          </div>
          <div className="flex w-full flex-col justify-between gap-8 p-4 md:flex-row">
            <div className="flex basis-1/2 flex-col gap-4">
              <span className="font-medium">Organization name</span>
              <span className="font-medium">{org?.name}</span>
            </div>
            <div className="flex flex-1 flex-col gap-8 md:flex-row">
              <div className="flex flex-1 flex-col gap-2">
                <span className="font-medium">Current plan</span>
                <span className="font-bold text-primary text-xl">
                  {org?.plan?.name}
                </span>
              </div>

              <div className="flex flex-1 items-start justify-start md:items-end md:justify-end">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-xl">
                    ${org?.plan?.price}
                  </span>
                  <Slash
                    className="h-5 w-5 text-muted-foreground/40"
                    strokeWidth={2.5}
                  />
                  <span className="font-semibold text-xl">month</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex w-full flex-col-reverse items-end justify-between gap-2 border-t p-4 md:flex-row md:items-center md:gap-0">
            <div>
              <span>For a complete list of features, visit our </span>
              <TextLink href="https://nhost.io/pricing" external>
                pricing
              </TextLink>
              <span> You can also visit our </span>
              <TextLink
                href="https://docs.nhost.io/platform/cloud/billing"
                external
              >
                documentation
              </TextLink>
              <span> for billing information</span>
            </div>
            <div className="flex w-full flex-row items-center justify-end gap-2">
              <ButtonWithLoading
                className="truncate"
                variant="outline"
                onClick={handleUpdatePaymentDetails}
                disabled={isFreeOrg}
                loading={loading}
              >
                <span className="truncate">Stripe Customer Portal</span>
              </ButtonWithLoading>
              <Button disabled={loading} onClick={() => setOpen(true)}>
                Upgrade
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className={cn(
            'max-h-[90vh] w-[calc(100vw-2rem)] max-w-6xl overflow-y-auto p-8 text-foreground sm:max-w-6xl lg:p-12',
            !loading && stripeClientSecret ? 'bg-white text-black' : '',
          )}
        >
          <DialogHeader className="mb-4">
            <DialogTitle className="pr-3 text-xl">
              Upgrade your plan
            </DialogTitle>
            <DialogDescription>
              Unlock more resources, backups, and support as you grow.
            </DialogDescription>
          </DialogHeader>

          {!stripeClientSecret && (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)}>
                <FormField
                  control={form.control}
                  name="plan"
                  render={() => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(value) =>
                            form.setValue('plan', value, { shouldDirty: true })
                          }
                          value={selectedPlanId}
                          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
                        >
                          {planOptions}

                          <FormItem>
                            <PlanCard
                              value={ENTERPRISE_PLAN_VALUE}
                              name="Enterprise"
                              price="Custom"
                              description={planDescriptions.Enterprise}
                              highlights={PLAN_HIGHLIGHTS.Enterprise}
                              isSelected={isEnterpriseSelected}
                              isCurrent={isEnterpriseCurrent}
                              disabled={isEnterpriseCurrent}
                            >
                              <div className="mt-4">
                                <TextLink href="mailto:hello@nhost.io" external>
                                  Contact us
                                </TextLink>
                              </div>
                            </PlanCard>
                          </FormItem>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
                  <div className="text-muted-foreground text-xs">
                    Cancel anytime, prorated billing.{' '}
                    <TextLink href="https://nhost.io/pricing" external>
                      See full pricing and feature comparison
                    </TextLink>
                  </div>
                  <DialogFooter className="mt-0">
                    <Button
                      variant="outline"
                      type="button"
                      disabled={form.formState.isSubmitting}
                      onClick={() => setOpen(false)}
                    >
                      Cancel
                    </Button>
                    <ButtonWithLoading
                      data-testid="upgradeOrgSubmitButton"
                      type="submit"
                      disabled={
                        !isEnterpriseSelected &&
                        selectedPlanId === org?.plan?.id
                      }
                      loading={form.formState.isSubmitting}
                    >
                      {submitLabel}
                      <ArrowUpRight className="ml-1 h-4 w-4" />
                    </ButtonWithLoading>
                  </DialogFooter>
                </div>
              </form>
            </Form>
          )}
          {stripeClientSecret && (
            <StripeEmbeddedForm clientSecret={stripeClientSecret} />
          )}
        </DialogContent>
      </Dialog>
      <FinishUpgradeOrganizationProcess />
    </>
  );
}
