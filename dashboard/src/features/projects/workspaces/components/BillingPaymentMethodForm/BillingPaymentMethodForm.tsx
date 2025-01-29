import { CountrySelector } from '@/components/form/CountrySelector';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import {
  refetchGetPaymentMethodsQuery,
  refetchPrefetchNewAppQuery,
  useInsertNewPaymentMethodMutation,
  useUpdateWorkspaceMutation,
} from '@/generated/graphql';
import { useSubmitState } from '@/hooks/useSubmitState';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { nhost } from '@/utils/nhost';
import { triggerToast } from '@/utils/toast';
import { useTheme } from '@mui/material';
import {
  CardElement,
  Elements,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import type { SyntheticEvent } from 'react';
import { useState } from 'react';

const stripePromise = process.env.NEXT_PUBLIC_STRIPE_PK
  ? loadStripe(process.env.NEXT_PUBLIC_STRIPE_PK)
  : null;

type AddPaymentMethodFormProps = {
  onPaymentMethodAdded?: () => void;
  workspaceId: string;
};

function AddPaymentMethodForm({
  onPaymentMethodAdded,
  workspaceId,
}: AddPaymentMethodFormProps) {
  const theme = useTheme();
  const stripe = useStripe();
  const elements = useElements();
  const user = nhost.auth.getUser();

  const [countryCode, setCountryCode] = useState('Select Country');

  const [insertNewPaymentMethod] = useInsertNewPaymentMethodMutation({
    refetchQueries: [
      refetchPrefetchNewAppQuery(),
      refetchGetPaymentMethodsQuery({
        workspaceId,
      }),
    ],
  });

  const [updateWorkspace] = useUpdateWorkspaceMutation();
  const { submitState, setSubmitState } = useSubmitState();

  const handleSubmit = async (e: SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSubmitState({
      loading: true,
      error: null,
    });

    try {
      // create payment method
      const cardElement = elements.getElement(CardElement);

      const { error: createPaymentMethodError, paymentMethod } =
        await stripe.createPaymentMethod({
          type: 'card',
          card: cardElement,
        });

      if (createPaymentMethodError) {
        throw new Error(
          createPaymentMethodError.message ||
            'An unknown error occurred. Please try again.',
        );
      }

      // attach new payment method to workspace
      const { error: attachPaymentMethodError } = await nhost.functions.call(
        '/stripe-attach-payment-method',
        {
          workspaceId,
          paymentMethodId: paymentMethod.id,
        },
      );

      if (attachPaymentMethodError) {
        throw new Error(
          (attachPaymentMethodError as any)?.response?.data ||
            'An unknown error occurred. Please try again.',
        );
      }

      // update workspace with new country code in database
      await updateWorkspace({
        variables: {
          id: workspaceId,
          workspace: {
            addressCountryCode: countryCode,
          },
        },
      });

      // insert payment method for workspace in database
      await insertNewPaymentMethod({
        variables: {
          workspaceId,
          paymentMethod: {
            stripePaymentMethodId: paymentMethod.id,
            workspaceId,
            cardExpMonth: paymentMethod.card.exp_month,
            cardExpYear: paymentMethod.card.exp_year,
            cardLast4: paymentMethod.card.last4,
            cardBrand: paymentMethod.card.brand,
            isDefault: true,
          },
        },
        refetchQueries: [
          refetchGetPaymentMethodsQuery({
            workspaceId,
          }),
        ],
      });
    } catch (error) {
      triggerToast(`Error adding a payment method: ${error.message}`);
      discordAnnounce(
        `Error trying to set up payment method: ${error.message}. (${user.email})`,
      );
      setSubmitState({
        error: Error(error.message),
        loading: false,
      });
      return;
    }

    // payment method added successfylly

    triggerToast('New payment method has been added to the workspace.');

    discordAnnounce(
      `(${user.email}) added a new credit card to workspace id: ${workspaceId}.`,
    );

    if (onPaymentMethodAdded) {
      onPaymentMethodAdded();
    }
  };

  return (
    <Box className="w-modal2 rounded-lg px-6 pb-6 pt-6 text-left">
      <div className="flex flex-col">
        <form onSubmit={handleSubmit}>
          <Text className="text-center text-lg font-medium">
            Add Payment Details
          </Text>
          <Text className="text-center font-normal">
            We&apos;ll store these in your workspace for future use.
          </Text>
          <Box className="my-2 mt-6 w-full rounded-lg border-1 px-2 py-2">
            <CardElement
              onReady={(element) => element.focus()}
              options={{
                hidePostalCode: false,
                iconStyle: 'default',
                style: {
                  base: {
                    fontSize: '16px',
                    iconColor: theme.palette.text.secondary,
                    color: theme.palette.text.primary,
                    '::placeholder': {
                      color: theme.palette.text.disabled,
                    },
                  },
                  invalid: {
                    color: theme.palette.error.main,
                  },
                },
              }}
            />
          </Box>
          <div className="mb-4 space-x-2">
            <CountrySelector value={countryCode} onChange={setCountryCode} />
          </div>
          <div className="flex flex-col">
            <Button
              type="submit"
              color="primary"
              className=""
              loading={submitState.loading}
            >
              Add Card
            </Button>
          </div>
        </form>
      </div>
    </Box>
  );
}

export interface BillingPaymentMethodFormProps {
  /**
   * Callback function to run after a payment method is added.
   */
  onPaymentMethodAdded?: (e?: any) => void;
  /**
   * Workspace identifier.
   */
  workspaceId: string;
}

export default function BillingPaymentMethodForm({
  onPaymentMethodAdded,
  workspaceId,
}: BillingPaymentMethodFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <AddPaymentMethodForm
        onPaymentMethodAdded={onPaymentMethodAdded}
        workspaceId={workspaceId}
      />
    </Elements>
  );
}
