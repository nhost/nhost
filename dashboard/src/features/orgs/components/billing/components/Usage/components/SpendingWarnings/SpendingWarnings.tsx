import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';

import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import { Progress } from '@/components/ui/v3/progress';
import { Switch } from '@/components/ui/v3/switch';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetOrganizationSpendingWarningDocument,
  useBillingGetNextInvoiceQuery,
  useGetOrganizationSpendingWarningQuery,
  useUpdateOrganizationSpendingWarningMutation,
} from '@/utils/__generated__/graphql';
import { yupResolver } from '@hookform/resolvers/yup';
import { useEffect, useMemo, type ChangeEvent } from 'react';
import { useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  enabled: Yup.boolean().required(),
  threshold: Yup.number().test(
    'is-valid-threshold',
    `Threshold must be either 0 (disabled) or greater than 110% of your plan's price`,
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

type SpendingWarningsFormValues = Yup.InferType<typeof validationSchema>;

export default function SpendingWarnings() {
  const { org } = useCurrentOrg();
  const { data, loading } = useGetOrganizationSpendingWarningQuery({
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

  const isPlatform = useIsPlatform();

  const isAdmin = useIsOrgAdmin();

  const [updateConfig] = useUpdateOrganizationSpendingWarningMutation({
    refetchQueries: [GetOrganizationSpendingWarningDocument],
  });

  const { openDialog } = useDialog();

  const { threshold } = data?.organizations[0] ?? {};

  const form = useForm<SpendingWarningsFormValues>({
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

  const { watch, setValue, trigger: triggerValidation } = form;

  const handleEnabledChange = (checked: boolean) => {
    setValue('enabled', checked, { shouldDirty: true });
    if (!checked) {
      setValue('threshold', 0, { shouldDirty: true });
    }
  };

  const enabled = watch('enabled');
  const currentThreshold = watch('threshold');

  const progress = useMemo(() => {
    if (!enabled || currentThreshold <= 0) {
      return 0;
    }

    const percent = (amountDue / currentThreshold) * 100;
    return Math.min(Math.max(percent, 0), 100);
  }, [amountDue, enabled, currentThreshold]);

  const handleThresholdChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.value === '') {
      setValue('threshold', undefined, { shouldDirty: true });
    } else {
      setValue('threshold', Number(event.target.value), { shouldDirty: true });
      triggerValidation('threshold');
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

  const onSubmit = async (values: SpendingWarningsFormValues) => {
    const updateConfigPromise = updateConfig({
      variables: {
        id: org?.id,
        threshold: values.threshold,
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        form.reset(values);

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
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

  if (loading || loadingInvoice) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex h-32 place-content-center">
            <ActivityIndicator
              label="Loading spending warnings..."
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
        className="flex flex-col gap-2"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex flex-col">
          {isAdmin && (
            <div>
              <FormField
                control={form.control}
                name="threshold"
                render={({ field }) => (
                  <FormItem className="p-4">
                    <FormLabel className="flex flex-row items-center gap-2">
                      <span className="text-muted-foreground">
                        Spending Notifications
                      </span>
                      <Tooltip
                        placement="right"
                        title={
                          <span>
                            You&apos;ll receive email alerts when your usage
                            reaches 75%, 90%, and 100% of your configured value.
                            These are notifications only - your service will
                            continue running normally.
                          </span>
                        }
                      >
                        <InfoIcon
                          aria-label="Info"
                          className="h-4 w-4"
                          color="primary"
                        />
                      </Tooltip>
                      <Switch
                        id="enabled"
                        checked={enabled}
                        onCheckedChange={handleEnabledChange}
                      />
                    </FormLabel>
                    <FormControl>
                      <Input
                        prefix="$"
                        className="max-w-32"
                        type="number"
                        placeholder="0"
                        disabled={!enabled}
                        {...field}
                        onChange={handleThresholdChange}
                        value={currentThreshold}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}

          {enabled && (
            <div className="flex flex-col gap-4 px-4 pb-4">
              <div className="flex flex-1 flex-row gap-1">
                <div className="flex max-w-xl flex-1 flex-col">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">${amountDue}</span>
                    <span className="text-muted-foreground">
                      ${currentThreshold} (threshold)
                    </span>
                  </div>
                  <Progress value={progress} className="h-3" />
                </div>
                <span className="-mb-1 self-end">
                  {progress ? `${Math.round(progress)}%` : '\u00A0'}
                </span>
              </div>
            </div>
          )}
          <div className="px-4 pb-4">
            <Button
              className="h-fit"
              type="submit"
              disabled={!form.formState.isDirty}
            >
              {form.formState.isSubmitting ? <ActivityIndicator /> : 'Save'}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
