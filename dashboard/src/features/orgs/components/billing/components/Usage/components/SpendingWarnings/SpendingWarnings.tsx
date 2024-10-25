import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import { Progress } from '@/components/ui/v3/progress';
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
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

const validationSchema = Yup.object({
  threshold: Yup.number()
    .test(
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
    )
    .required(),
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

  const showAmountDue =
    typeof amountDue === 'number' && !Number.isNaN(amountDue);

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
      threshold: threshold ?? 0,
    },
    resolver: yupResolver(validationSchema),
    context: {
      planPrice: org?.plan?.price ?? 0,
    },
  });

  const {
    formState: { errors, isDirty, isSubmitting },
    watch,
    setValue,
    trigger: triggerValidation,
  } = form;

  const currentThreshold = watch('threshold');

  const progress = useMemo(() => {
    if (!showAmountDue || currentThreshold <= 0) {
      return 0;
    }

    const percent = (amountDue / currentThreshold) * 100;
    return Math.min(Math.max(percent, 0), 100);
  }, [amountDue, showAmountDue, currentThreshold]);

  const submitDisabled = !isDirty || isSubmitting;

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
        threshold,
      });
    }
  }, [loading, threshold, form]);

  const handleSubmit = async (values: SpendingWarningsFormValues) => {
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
        loadingMessage: 'Spending warnings are being updated...',
        successMessage: 'Spending warnings have been updated successfully.',
        errorMessage:
          'An error occurred while trying to update spending warnings.',
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
    <div className="flex flex-col p-4">
      <div className="flex w-full flex-col">
        <div className="flex flex-row items-center gap-2">
          <span className="text-muted-foreground">Spending Notifications</span>
          <Tooltip
            placement="right"
            title={
              <span>
                You&apos;ll receive email alerts when your usage reaches 75%,
                90%, and 100% of your configured value. These are notifications
                only - your service will continue running normally.
              </span>
            }
          >
            <InfoIcon aria-label="Info" className="h-4 w-4" color="primary" />
          </Tooltip>
        </div>
        <span className="">${threshold}</span>
      </div>
      <div className="flex flex-col gap-4">
        {showAmountDue && (
          <>
            <p>
              Spent ${amountDue} of ${currentThreshold} (notification threshold)
            </p>
            <div className="flex flex-row items-center gap-1">
              <Progress value={progress} className="h-2 max-w-xl" />
              <span>{progress ? `${Math.round(progress)}%` : '\u00A0'}</span>
            </div>
          </>
        )}
      </div>
      {isAdmin && (
        <FormProvider {...form}>
          <Form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              onChange={handleThresholdChange}
              value={currentThreshold}
              id="threshold"
              name="threshold"
              label="Notification Threshold"
              type="number"
              placeholder="0"
              hideEmptyHelperText
              fullWidth
              error={!!errors.threshold}
              helperText={errors.threshold?.message}
            />
            <div className="grid grid-flow-col items-center justify-end pt-3.5">
              <Button type="submit" className="h-fit" disabled={submitDisabled}>
                Save
              </Button>
            </div>
          </Form>
        </FormProvider>
      )}
    </div>
  );
}
