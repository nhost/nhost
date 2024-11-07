import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Switch } from '@/components/ui/v2/Switch';
import { Button } from '@/components/ui/v3/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import { Progress } from '@/components/ui/v3/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetOrganizationSpendingNotificationDocument,
  useBillingGetNextInvoiceQuery,
  useGetOrganizationSpendingNotificationQuery,
  useUpdateOrganizationSpendingNotificationMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean().required(),
  threshold: Yup.number().test(
    'is-valid-threshold',
    `Threshold must be greater than 110% of your plan's price`,
    (value: number, { options }) => {
      const planPrice = options?.context?.planPrice || 0;
      if (value === 0) {
        return true;
      }
      if (typeof value === 'number' && value > 1.1 * planPrice) {
        return true;
      }
      return false;
    },
  ),
});

type SpendingNotificationsFormValues = Yup.InferType<typeof validationSchema>;

export default function SpendingNotifications() {
  const { org } = useCurrentOrg();

  const isAdmin = useIsOrgAdmin();

  const { data, loading } = useGetOrganizationSpendingNotificationQuery({
    fetchPolicy: 'cache-first',
    variables: { orgId: org?.id },
    skip: !org,
  });

  const { data: nextInvoiceData, loading: loadingInvoice } =
    useBillingGetNextInvoiceQuery({
      fetchPolicy: 'cache-first',
      variables: {
        organizationID: org?.id,
      },
      skip: !org,
    });

  const amountDue = nextInvoiceData?.billingGetNextInvoice?.AmountDue ?? null;

  const [updateConfig] = useUpdateOrganizationSpendingNotificationMutation({
    refetchQueries: [GetOrganizationSpendingNotificationDocument],
  });

  const { threshold } = data?.organizations[0] ?? {};

  const form = useForm<SpendingNotificationsFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      enabled: false,
      threshold: threshold ?? 0,
    },
    resolver: yupResolver(validationSchema),
    context: {
      planPrice: org?.plan?.price ?? 0,
    },
  });

  const { watch, setValue } = form;

  const currentThreshold = watch('threshold');

  const handleEnabledChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { checked } = event.target;
    setValue('enabled', checked, { shouldDirty: true });
    if (!checked) {
      setValue('threshold', 0, { shouldDirty: true });
    }
  };

  const enabled = watch('enabled');

  const progress = useMemo(() => {
    if (!enabled || threshold <= 0 || !amountDue) {
      return 0;
    }

    const percent = (amountDue / threshold) * 100;
    return Math.min(Math.max(percent, 0), 100);
  }, [amountDue, enabled, threshold]);

  const handleThresholdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.value === '') {
      setValue('threshold', undefined, { shouldDirty: true });
    } else {
      setValue('threshold', Number(event.target.value), { shouldDirty: true });
    }
  };

  useEffect(() => {
    if (!loading) {
      form.reset({
        enabled: !!threshold,
        threshold,
      });
    }
  }, [loading, threshold, form]);

  const onSubmit = async (values: SpendingNotificationsFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        id: org?.id,
        threshold: values.threshold,
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset({
          enabled: !!values.threshold,
          threshold: values.threshold,
        });
      },
      {
        loadingMessage: 'Spending notifications are being updated...',
        successMessage:
          'Spending notifications have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update spending notifications.',
      },
    );
  };

  const getNotificationPercentageAmount = (factor: number) => {
    if (!threshold || threshold <= 0) {
      return '\u00A0';
    }
    const amount = threshold * factor;
    return `$${Math.round(amount)}`;
  };

  const inputMin = useMemo(
    () => Math.ceil(1.1 * (amountDue ?? 0)),
    [amountDue],
  );

  if (loading || loadingInvoice) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex h-32 place-content-center">
            <ActivityIndicator
              label="Loading spending notifications..."
              className="justify-center text-sm"
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-4 p-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex flex-1 flex-row items-end justify-between gap-8">
          <span className="font-medium">Spending Notifications</span>
          <Switch
            className="self-end"
            id="enabled"
            checked={enabled}
            onChange={handleEnabledChange}
          />
        </div>
        <div className="flex w-full flex-col justify-between gap-8 md:flex-row">
          <div className="flex basis-1/2 flex-col gap-2">
            <p className="max-w-prose">
              Specify a spending threshold to receive email notifications when
              your usage approaches the designated amount.
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-4">
            {enabled && (
              <>
                <FormField
                  control={form.control}
                  name="threshold"
                  render={({ field }) => (
                    <FormItem className="flex flex-1 flex-col">
                      <FormLabel className="flex flex-1 flex-row items-center gap-2">
                        <span>Amount</span>
                      </FormLabel>
                      <FormControl>
                        {isAdmin ? (
                          <Input
                            prefix="$"
                            type="number"
                            min={inputMin}
                            placeholder="0"
                            disabled={!enabled}
                            {...field}
                            onChange={handleThresholdChange}
                            value={currentThreshold}
                          />
                        ) : (
                          <Tooltip>
                            <TooltipTrigger type="button">
                              <Input
                                prefix="$"
                                type="number"
                                min="0"
                                placeholder="0"
                                disabled
                                {...field}
                                onChange={handleThresholdChange}
                                value={currentThreshold}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              Only an organization admin can change this value.
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex flex-1">
                    <div className="basis-3/4" />
                    <div className="flex flex-1 justify-between gap-2">
                      <div className="flex basis-2/3 text-muted-foreground">
                        <span className="w-13 text-center">75%</span>
                      </div>
                      <div className="flex basis-1/3 text-muted-foreground">
                        <span className="w-13 text-center">90%</span>
                      </div>
                      <div className="flex basis-1/3 text-muted-foreground">
                        <span className="w-13 text-center">100%</span>
                      </div>
                    </div>
                  </div>
                  <Progress value={progress} className="h-3" />
                  <div className="flex flex-1">
                    <div className="basis-3/4" />
                    <div className="flex flex-1 justify-between gap-2">
                      <div className="flex basis-2/3 text-muted-foreground">
                        <span className="w-13 overflow-hidden text-ellipsis text-center">
                          {getNotificationPercentageAmount(0.75) || '\u00A0'}
                        </span>
                      </div>
                      <div className="flex basis-1/3 text-muted-foreground">
                        <span className="w-13 overflow-hidden text-ellipsis text-center">
                          {getNotificationPercentageAmount(0.9) || '\u00A0'}
                        </span>
                      </div>
                      <div className="flex basis-1/3 text-muted-foreground">
                        <span className="w-13 overflow-hidden text-ellipsis text-center">
                          {getNotificationPercentageAmount(1) || '\u00A0'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="max-w-prose">
                  You&apos;ll receive email alerts when your usage reaches 75%,
                  90%, and 100% of your configured value. These are
                  notifications only - your service will continue running
                  normally.
                </p>
              </>
            )}
            <div className="flex flex-1 flex-col justify-end">
              <Button
                type="submit"
                className="h-fit self-end"
                disabled={!form.formState.isDirty || !isAdmin}
              >
                {form.formState.isSubmitting ? (
                  <ActivityIndicator className="text-sm" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  );
}
