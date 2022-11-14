import { BillingPaymentMethodForm } from '@/components/billing-payment-method/BillingPaymentMethodForm';
import { useDialog } from '@/components/common/DialogProvider';
import type { GetPaymentMethodsFragment } from '@/generated/graphql';
import {
  refetchGetPaymentMethodsQuery,
  useDeletePaymentMethodMutation,
  useGetPaymentMethodsQuery,
  useSetNewDefaultPaymentMethodMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Modal } from '@/ui/Modal';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { triggerToast } from '@/utils/toast';
import { formatDistanceToNowStrict } from 'date-fns';
import { useRouter } from 'next/router';
import { useState } from 'react';

function CheckCircle() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-6 w-6 fill-lightBlue"
    >
      <path
        fillRule="evenodd"
        d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function WorkspacePaymentMethods() {
  const router = useRouter();
  const { action } = router.query;

  const { currentWorkspace } = useCurrentWorkspaceAndApplication();
  const { openAlertDialog } = useDialog();

  const [showAddPaymentMethodModal, setShowAddPaymentMethodModal] = useState(
    action === 'add-payment-method',
  );

  const { loading, error, data } = useGetPaymentMethodsQuery({
    variables: {
      workspaceId: currentWorkspace.id,
    },
  });

  const [setNewDefaultPaymentMethod] = useSetNewDefaultPaymentMethodMutation();
  const [deletePaymentMethod] = useDeletePaymentMethodMutation();

  const handleDeletePaymentMethod = async (
    paymentMethod: GetPaymentMethodsFragment,
  ) => {
    // check if this is the last payment method
    const isLastPaymentMethod = data?.paymentMethods.length === 1;

    // can not delete a payment method that is default
    // (unless it's the last one - and the workspace has now paid projects which
    // we check in the next if statement)
    if (paymentMethod.isDefault && !isLastPaymentMethod) {
      triggerToast(
        'You cannot delete a payment method that is default payment method',
      );
      return;
    }

    if (isLastPaymentMethod) {
      // if so, make sure no non-free projects exists for the workspace
      const workspaceHasPaidProjects = currentWorkspace.applications.some(
        (app) => !app.plan.isFree,
      );

      if (workspaceHasPaidProjects) {
        triggerToast(
          'You cannot delete the last payment method on a workspace with paid projects.',
        );
        return;
      }
    }

    try {
      await deletePaymentMethod({
        variables: {
          paymentMethodId: paymentMethod.id,
        },
        refetchQueries: [
          refetchGetPaymentMethodsQuery({
            workspaceId: currentWorkspace.id,
          }),
        ],
      });
    } catch (deletePaymentMethodError) {
      triggerToast(deletePaymentMethodError.message);
      return;
    }

    triggerToast('Payment method deleted.');
  };

  if (loading) {
    return <ActivityIndicator delay={1000} className="mt-18 justify-center" />;
  }

  if (error) {
    throw error;
  }

  const { paymentMethods } = data;

  const maxPaymentMethodsReached = paymentMethods.length >= 3;

  return (
    <div className="mt-18">
      <div className="mx-auto max-w-3xl font-display">
        <Text variant="h3">Payment Methods</Text>

        <div className="mt-4 w-full">
          <table className="w-full">
            <thead className="border-b-1">
              <tr>
                <th className="text-left">Brand</th>
                <th className="text-left">Default</th>
                <th className="text-left">Last 4</th>
                <th className="text-left">Exp. Date</th>
                <th className="text-left">Card Added</th>
                <th className="text-left"> </th>
              </tr>
            </thead>
            <tbody>
              {paymentMethods.map((paymentMethod) => {
                const {
                  id,
                  cardBrand,
                  isDefault,
                  cardLast4,
                  cardExpMonth,
                  cardExpYear,
                  createdAt,
                } = paymentMethod;

                return (
                  <tr key={id} className="border-b-1">
                    <td className="py-3">{cardBrand}</td>
                    <td>{isDefault && <CheckCircle />}</td>
                    <td>{cardLast4}</td>
                    <td>
                      {cardExpMonth}/{cardExpYear}
                    </td>
                    <td>
                      {formatDistanceToNowStrict(new Date(createdAt), {
                        addSuffix: true,
                      })}
                    </td>
                    <td className="text-center">
                      {!isDefault && (
                        <Button
                          color="secondary"
                          size="small"
                          variant="borderless"
                          onClick={async () => {
                            try {
                              await setNewDefaultPaymentMethod({
                                variables: {
                                  workspaceId: currentWorkspace.id,
                                  paymentMethodId: id,
                                },
                                refetchQueries: [
                                  refetchGetPaymentMethodsQuery({
                                    workspaceId: currentWorkspace.id,
                                  }),
                                ],
                              });
                            } catch (setPaymentMethodError) {
                              triggerToast(setPaymentMethodError.message);
                            }
                          }}
                        >
                          Set Default
                        </Button>
                      )}
                    </td>
                    <td className="text-right">
                      <Button
                        color="error"
                        size="small"
                        variant="borderless"
                        onClick={() => {
                          openAlertDialog({
                            title: 'Delete Payment Method',
                            payload: `Are you sure you want to delete this payment?`,
                            props: {
                              primaryButtonText: 'Delete',
                              primaryButtonColor: 'error',
                              onPrimaryAction: () =>
                                handleDeletePaymentMethod(paymentMethod),
                            },
                          });
                        }}
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="my-6">
          {!maxPaymentMethodsReached && (
            <Button
              variant="outlined"
              onClick={() => {
                setShowAddPaymentMethodModal(true);
              }}
              disabled={maxPaymentMethodsReached}
            >
              Add Payment Method
            </Button>
          )}
          {maxPaymentMethodsReached && (
            <div className="my-2 text-sm text-red">
              You can have at most three payment methods per workspace. To add a
              new payment method, please first delete one of your existing
              payment methods.
            </div>
          )}
          {showAddPaymentMethodModal && (
            <Modal
              showModal={showAddPaymentMethodModal}
              close={() =>
                setShowAddPaymentMethodModal(!showAddPaymentMethodModal)
              }
            >
              <BillingPaymentMethodForm
                workspaceId={currentWorkspace.id}
                close={() => setShowAddPaymentMethodModal(false)}
              />
            </Modal>
          )}
        </div>
      </div>
    </div>
  );
}
