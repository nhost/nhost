import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Checkbox } from '@/components/ui/v2/Checkbox';
import { BaseDialog } from '@/components/ui/v2/Dialog';
import { Text } from '@/components/ui/v2/Text';
import { useAppState } from '@/features/projects/common/hooks/useAppState';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { planDescriptions } from '@/features/projects/common/utils/planDescriptions';
import { BillingPaymentMethodForm } from '@/features/projects/workspaces/components/BillingPaymentMethodForm';
import {
  refetchGetApplicationPlanQuery,
  useGetAppPlanAndGlobalPlansQuery,
  useGetPaymentMethodsQuery,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

function Plan({ planName, price, setPlan, planId, selectedPlanId }: any) {
  return (
    <button
      type="button"
      className="grid items-center justify-between w-full grid-flow-col gap-2 px-1 my-4"
      onClick={setPlan}
      tabIndex={-1}
    >
      <div className="grid grid-flow-row gap-y-0.5">
        <div className="grid items-center justify-start grid-flow-col gap-2">
          <Checkbox
            onChange={setPlan}
            checked={selectedPlanId === planId}
            aria-label={planName}
          />

          <Text
            variant="h3"
            component="p"
            className="self-center font-medium text-left"
          >
            Upgrade to {planName}
          </Text>
        </div>

        <Text variant="subtitle2" className="w-full max-w-[256px] text-start">
          {planDescriptions[planName]}
        </Text>
      </div>

      <Text variant="h3" component="p">
        ${price}/mo
      </Text>
    </button>
  );
}

export function ChangePlanModalWithData({ app, plans, close }: any) {
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const { closeAlertDialog } = useDialog();
  const [pollingCurrentProject, setPollingCurrentProject] = useState(false);

  const {
    currentWorkspace,
    currentProject,
    refetch: refetchWorkspaceAndProject,
  } = useCurrentWorkspaceAndProject();
  const { state } = useAppState();

  const { data } = useGetPaymentMethodsQuery({
    variables: {
      workspaceId: currentWorkspace?.id,
    },
    skip: !currentWorkspace,
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const paymentMethodAvailable = data?.paymentMethods.length > 0;

  const currentPlan = plans.find((plan) => plan.id === app.plan.id);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);
  const higherPlans = plans.filter((plan) => plan.price > currentPlan.price);

  useEffect(() => {
    if (!pollingCurrentProject || state === ApplicationStatus.Paused) {
      return;
    }

    close?.();
    closeAlertDialog();
    setShowPaymentModal(false);
    setPollingCurrentProject(false);
  }, [state, pollingCurrentProject, close, closeAlertDialog]);

  useEffect(() => {
    if (!pollingCurrentProject) {
      return () => {};
    }

    const interval = setInterval(() => {
      refetchWorkspaceAndProject();
    }, 1000);

    return () => clearInterval(interval);
  }, [pollingCurrentProject, refetchWorkspaceAndProject, currentProject]);

  const [updateApp] = useUpdateApplicationMutation({
    refetchQueries: [
      refetchGetApplicationPlanQuery({
        workspace: currentWorkspace.slug,
        slug: currentProject.slug,
      }),
    ],
  });

  const handleUpdateAppPlan = async () => {
    await execPromiseWithErrorToast(
      async () => {
        updateApp({
          variables: {
            appId: app.id,
            app: {
              planId: selectedPlan.id,
              desiredState: 5,
            },
          },
        });

        setPollingCurrentProject(true);
      },
      {
        loadingMessage: 'Updating plan...',
        successMessage: `Plan has been updated successfully to ${selectedPlan.name}.`,
        errorMessage:
          'An error occurred while updating the plan. Please try again.',
      },
    );
  };

  const handleChangePlanClick = async () => {
    if (!selectedPlan) {
      return;
    }

    if (!paymentMethodAvailable) {
      setShowPaymentModal(true);

      return;
    }

    await handleUpdateAppPlan();
  };

  if (pollingCurrentProject) {
    return (
      <Box className="w-full max-w-xl p-6 mx-auto text-left rounded-lg">
        <div className="flex flex-col">
          <div className="mx-auto">
            <Image
              src="/assets/upgrade.svg"
              alt="Nhost Logo"
              width={72}
              height={72}
            />
          </div>

          <Text variant="h3" component="h2" className="mt-2 text-center">
            Successfully upgraded to {currentPlan.name}
          </Text>

          <ActivityIndicator
            label="We are unpausing your project. This may take some time..."
            className="mx-auto mt-2"
          />

          <Button
            variant="outlined"
            color="secondary"
            className="w-full max-w-sm mx-auto mt-4"
            onClick={() => {
              if (close) {
                close();
              }

              closeAlertDialog();
            }}
          >
            Cancel
          </Button>
        </div>
      </Box>
    );
  }

  return (
    <Box className="w-full max-w-xl p-6 text-left rounded-lg">
      <BaseDialog
        open={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
      >
        <BillingPaymentMethodForm
          onPaymentMethodAdded={handleUpdateAppPlan}
          workspaceId={currentWorkspace.id}
        />
      </BaseDialog>

      <div className="flex flex-col">
        <div className="mx-auto">
          <Image
            src="/assets/upgrade.svg"
            alt="Nhost Logo"
            width={72}
            height={72}
          />
        </div>
        <Text variant="h3" component="h2" className="mt-2 text-center">
          Pick Your Plan
        </Text>
        <Text className="text-center">
          You&apos;re currently on the <strong>{app.plan.name}</strong> plan.
        </Text>

        <div className="mt-2">
          {higherPlans
            .filter((plan) => plan.id !== app.plan.id)
            .map((plan) => (
              <div className="mt-4" key={plan.id}>
                <Plan
                  planName={plan.name}
                  currentPlan={currentPlan}
                  key={plan.id}
                  planId={plan.id}
                  selectedPlanId={selectedPlanId}
                  price={plan.price}
                  setPlan={() => setSelectedPlanId(plan.id)}
                />
              </div>
            ))}
        </div>

        <div className="grid grid-flow-row gap-2 mt-2">
          <Button
            onClick={handleChangePlanClick}
            disabled={!selectedPlan}
            loading={pollingCurrentProject}
          >
            Upgrade
          </Button>

          <Button
            variant="outlined"
            color="secondary"
            onClick={() => {
              if (close) {
                close();
              }

              closeAlertDialog();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </Box>
  );
}

export interface ChangePlanModalProps {
  /**
   * Function to close the modal.
   */
  onCancel?: () => void;
}

export default function ChangePlanModal({ onCancel }: ChangePlanModalProps) {
  const {
    query: { workspaceSlug, appSlug },
  } = useRouter();

  const { data, loading, error } = useGetAppPlanAndGlobalPlansQuery({
    variables: {
      workspaceSlug: workspaceSlug as string,
      appSlug: appSlug as string,
    },
    fetchPolicy: 'cache-first',
  });

  if (error) {
    throw error;
  }

  if (loading) {
    return (
      <ActivityIndicator delay={500} label="Loading plans..." className="m-8" />
    );
  }

  const { apps, plans } = data;
  const app = apps[0];

  return <ChangePlanModalWithData app={app} plans={plans} close={onCancel} />;
}
