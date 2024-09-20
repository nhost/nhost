import { useDialog } from '@/components/common/DialogProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Button } from '@/components/ui/v2/Button';
import { Table } from '@/components/ui/v2/Table';
import { TableBody } from '@/components/ui/v2/TableBody';
import { TableCell } from '@/components/ui/v2/TableCell';
import { TableContainer } from '@/components/ui/v2/TableContainer';
import { TableHead } from '@/components/ui/v2/TableHead';
import { TableRow } from '@/components/ui/v2/TableRow';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsCurrentUserOwner } from '@/features/projects/common/hooks/useIsCurrentUserOwner';
import { BillingPaymentMethodForm } from '@/features/projects/workspaces/components/BillingPaymentMethodForm';
import type { GetPaymentMethodsFragment } from '@/generated/graphql';
import {
  refetchGetPaymentMethodsQuery,
  useDeletePaymentMethodMutation,
  useGetPaymentMethodsQuery,
  useSetNewDefaultPaymentMethodMutation,
} from '@/generated/graphql';
import { triggerToast } from '@/utils/toast';
import { useTheme } from '@mui/material';
import { formatDistanceToNowStrict } from 'date-fns';

function CheckCircle() {
  const theme = useTheme();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill={theme.palette.primary.main}
      className="h-6 w-6"
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
  const { currentWorkspace } = useCurrentWorkspaceAndProject();
  const { openAlertDialog, openDialog, closeDialog } = useDialog();
  const isOwner = useIsCurrentUserOwner();

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
      const workspaceHasPaidProjects = currentWorkspace.projects.some(
        (app) => !app.legacyPlan.isFree,
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

        <TableContainer
          className="mt-4 w-full"
          sx={{ backgroundColor: 'background.paper' }}
        >
          <Table className="w-full">
            <TableHead className="border-b-1">
              <TableRow>
                <TableCell className="text-left">Brand</TableCell>
                <TableCell className="text-left">Default</TableCell>
                <TableCell className="text-left">Last 4</TableCell>
                <TableCell className="text-left">Exp. Date</TableCell>
                <TableCell className="text-left">Card Added</TableCell>
                <TableCell className="text-left"> </TableCell>
                {isOwner && <TableCell className="text-left"> </TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
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
                  <TableRow key={id} className="border-b-1">
                    <TableCell className="py-3">{cardBrand}</TableCell>
                    <TableCell>{isDefault && <CheckCircle />}</TableCell>
                    <TableCell>{cardLast4}</TableCell>
                    <TableCell>
                      {cardExpMonth}/{cardExpYear}
                    </TableCell>
                    <TableCell>
                      {formatDistanceToNowStrict(new Date(createdAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell className="text-center">
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
                    </TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
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
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        {isOwner && (
          <div className="my-6">
            {!maxPaymentMethodsReached && (
              <Button
                variant="outlined"
                onClick={() => {
                  openDialog({
                    component: (
                      <BillingPaymentMethodForm
                        workspaceId={currentWorkspace.id}
                        onPaymentMethodAdded={closeDialog}
                      />
                    ),
                  });
                }}
                disabled={maxPaymentMethodsReached}
              >
                Add Payment Method
              </Button>
            )}
            {maxPaymentMethodsReached && (
              <Text className="my-2 text-sm" color="error">
                You can have at most three payment methods per workspace. To add
                a new payment method, please first delete one of your existing
                payment methods.
              </Text>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
