import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Button } from '@/components/ui/v3/button';
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { planDescriptions } from '@/features/projects/common/utils/planDescriptions';
import {
  useBillingChangeOrganizationPlanMutation,
  useBillingOrganizationCustomePortalLazyQuery,
  useGetOrganizationPlansQuery,
} from '@/utils/__generated__/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { Slash } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const changeOrgPlanForm = z.object({
  plan: z.string(),
});

export default function SubscriptionPlan() {
  const { org, refetch: refetchOrg } = useCurrentOrg();
  const [open, setOpen] = useState(false);
  const [changeOrgPlan] = useBillingChangeOrganizationPlanMutation();
  const { data: { plans = [] } = {} } = useGetOrganizationPlansQuery();
  const [fetchOrganizationCustomePortalLink] =
    useBillingOrganizationCustomePortalLazyQuery();

  const form = useForm<z.infer<typeof changeOrgPlanForm>>({
    resolver: zodResolver(changeOrgPlanForm),
    defaultValues: {
      plan: '',
    },
  });

  useEffect(() => {
    if (org) {
      form.setValue('plan', org?.plan.id, { shouldDirty: false });
    }
  }, [form, org]);

  const selectedPlan = form.watch('plan');

  const onSubmit = async (values: z.infer<typeof changeOrgPlanForm>) => {
    const { plan: planID } = values;
    const { id: organizationID } = org;

    await execPromiseWithErrorToast(
      async () => {
        await changeOrgPlan({
          variables: {
            organizationID,
            planID,
          },
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
          window.open(billingOrganizationCustomePortal);
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

  return (
    <>
      <div>
        <div className="flex flex-col w-full border rounded-md bg-background">
          <div className="flex flex-col w-full gap-1 p-4 border-b">
            <h4 className="font-medium">Subscription plan</h4>
          </div>
          <div className="flex flex-col border-b md:flex-row">
            <div className="flex flex-col w-full gap-4 p-4">
              <span className="font-medium">Organization name</span>
              <span className="font-medium">{org?.name}</span>
            </div>
            <div className="flex flex-col w-full gap-2 p-4">
              <span className="font-medium">Current plan</span>
              <span className="text-xl font-bold text-primary-main">
                {org?.plan?.name}
              </span>
            </div>
            <div className="flex flex-col items-start justify-start w-full gap-4 p-4 md:items-end md:justify-end">
              <div className="flex items-center gap-2">
                <span className="text-xl font-semibold">
                  ${org?.plan?.price}
                </span>
                <Slash
                  className="w-5 h-5 text-muted-foreground/40"
                  strokeWidth={2.5}
                />
                <span className="text-xl font-semibold">month</span>
              </div>
            </div>
          </div>
          <div className="flex flex-col-reverse items-end justify-between w-full gap-2 p-4 md:flex-row md:items-center md:gap-0">
            <div>
              <span>For a complete list of features, visit our </span>
              <Link
                href="https://nhost.io/pricing"
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                className="font-medium"
              >
                pricing
                <ArrowSquareOutIcon className="w-4 h-4 ml-1" />
              </Link>
            </div>
            <div className="flex flex-row items-center justify-end gap-2">
              <Button
                className="h-fit"
                variant="secondary"
                onClick={handleUpdatePaymentDetails}
                disabled={org?.plan?.isFree}
              >
                Update payment details
              </Button>
              <Button
                disabled={org?.plan?.isFree}
                className="h-fit"
                onClick={() => setOpen(true)}
              >
                Upgrade
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="text-foreground sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Upgrade Organization {org?.name}</DialogTitle>
            <DialogDescription />
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="plan"
                render={({ field }) => (
                  <FormItem className="">
                    <div>
                      <FormLabel>Plan</FormLabel>
                    </div>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex flex-col space-y-1"
                      >
                        {plans.map((plan) => (
                          <FormItem key={plan.id}>
                            <FormLabel className="flex flex-row items-center justify-between w-full p-3 space-y-0 border rounded-md cursor-pointer">
                              <div className="flex flex-row items-center space-x-3">
                                <FormControl>
                                  <RadioGroupItem value={plan.id} />
                                </FormControl>
                                <div className="flex flex-col space-y-2">
                                  <div className="font-semibold text-md">
                                    {plan.name}
                                  </div>
                                  <FormDescription className="w-2/3 text-xs">
                                    {planDescriptions[plan.name]}
                                  </FormDescription>
                                </div>
                              </div>

                              <div className="flex items-center h-full mt-0 text-xl font-semibold">
                                {plan.isFree ? 'Free' : `${plan.price}/mo`}
                              </div>
                            </FormLabel>
                          </FormItem>
                        ))}

                        <div>
                          <div className="flex flex-row items-center justify-between w-full p-3 space-y-0 border rounded-md cursor-pointer">
                            <div className="flex flex-row items-center space-x-3">
                              <div className="flex flex-col space-y-2">
                                <div className="font-semibold text-md">
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
                              <ArrowSquareOutIcon className="w-4 h-4 ml-1" />
                            </Link>
                          </div>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  variant="secondary"
                  type="button"
                  disabled={form.formState.isSubmitting}
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    selectedPlan === org?.plan?.id ||
                    form.formState.isSubmitting
                  }
                >
                  {form.formState.isSubmitting ? 'Upgrading...' : 'Upgrade'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
