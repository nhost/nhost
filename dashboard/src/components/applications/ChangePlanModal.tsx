import { BillingPaymentMethodForm } from '@/components/billing-payment-method/BillingPaymentMethodForm';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/context/UIContext';
import {
  refetchGetApplicationPlanQuery,
  useGetAppPlanAndGlobalPlansQuery,
  useGetPaymentMethodsQuery,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Modal } from '@/ui/Modal';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Checkbox from '@/ui/v2/Checkbox';
import Text from '@/ui/v2/Text';
import { planDescriptions } from '@/utils/planDescriptions';
import { triggerToast } from '@/utils/toast';
import { useTheme } from '@mui/material';
import Image from 'next/image';
import { useRouter } from 'next/router';
import { useState } from 'react';

function Plan({
  planName,
  price,
  setPlan,
  planId,
  selectedPlanId,
  currentPlan,
}: any) {
  return (
    <button
      type="button"
      className="my-4 grid w-full grid-flow-col items-center justify-between px-1"
      onClick={setPlan}
      tabIndex={-1}
    >
      <div className="grid grid-flow-row gap-y-0.5">
        <div className="flex flex-row items-center">
          <Checkbox
            onChange={setPlan}
            checked={selectedPlanId === planId}
            aria-label={planName}
          />

          <Text
            variant="h3"
            component="p"
            className="ml-2 self-center font-medium"
          >
            {currentPlan.price > price ? 'Downgrade' : 'Upgrade'} to {planName}
          </Text>
        </div>
        <Text variant="subtitle2" className="w-64 text-start">
          {planDescriptions[planName]}
        </Text>
      </div>

      <Text variant="h3" component="p">
        $ {price}/mo
      </Text>
    </button>
  );
}

export function ChangePlanModalWithData({ app, plans, close }: any) {
  const theme = useTheme();
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const { closeAlertDialog } = useDialog();

  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

  // get workspace payment methods
  const { data } = useGetPaymentMethodsQuery({
    variables: {
      workspaceId: currentWorkspace.id,
    },
  });

  const { openPaymentModal, closePaymentModal, paymentModal } = useUI();
  const paymentMethodAvailable = data?.paymentMethods.length > 0;

  const currentPlan = plans.find((plan) => plan.id === app.plan.id);
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId);

  const isDowngrade = currentPlan.price > selectedPlan?.price;

  // graphql mutations
  const [updateApp] = useUpdateAppMutation({
    refetchQueries: [
      refetchGetApplicationPlanQuery({
        workspace: currentWorkspace.slug,
        slug: currentApplication.slug,
      }),
    ],
  });

  // function handlers
  const handleUpdateAppPlan = async () => {
    await updateApp({
      variables: {
        id: app.id,
        app: {
          planId: selectedPlan.id,
        },
      },
    });

    if (isDowngrade) {
      if (close) {
        close();
      }

      closeAlertDialog();
    }

    triggerToast(
      `${currentApplication.name} plan changed to ${selectedPlan.name}.`,
    );
  };

  const handleChangePlanClick = async () => {
    if (!selectedPlan) {
      return;
    }

    if (!paymentMethodAvailable) {
      openPaymentModal();

      return;
    }

    await handleUpdateAppPlan();

    if (close) {
      close();
    }

    closeAlertDialog();
  };

  return (
    <Box className="w-welcome rounded-lg p-6 text-left">
      <Modal
        showModal={paymentModal}
        close={closePaymentModal}
        dialogStyle={{ zIndex: theme.zIndex.modal + 1 }}
      >
        <BillingPaymentMethodForm
          close={closePaymentModal}
          onPaymentMethodAdded={handleUpdateAppPlan}
          workspaceId={currentWorkspace.id}
        />
      </Modal>
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

        <div className="mt-5">
          {plans
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

        <div className="mt-6 grid grid-flow-row gap-2">
          <Button onClick={handleChangePlanClick} disabled={!selectedPlan}>
            {!selectedPlan && 'Change Plan'}
            {selectedPlan && isDowngrade && 'Downgrade'}
            {selectedPlan && !isDowngrade && 'Upgrade'}
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
   * Function to close the modal if mounted on parent component.
   *
   * @deprecated Implement modal by using `openAlertDialog` hook instead.
   */
  close?: () => void;
}

export function ChangePlanModal({ close }: ChangePlanModalProps) {
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

  return <ChangePlanModalWithData app={app} plans={plans} close={close} />;
}
