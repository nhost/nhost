import {
  CheckoutStatus,
  type PostOrganizationRequestMutation,
  usePostOrganizationRequestMutation,
} from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useAuthenticationStatus } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export type FinishOrgCreationOnCompletedCb = (
  data: PostOrganizationRequestMutation['billingPostOrganizationRequest'],
) => void;

interface UseFinishOrgCreationProps {
  onCompleted: FinishOrgCreationOnCompletedCb;
  onError?: () => void;
}

function useFinishOrgCreation({
  onCompleted,
  onError,
}: UseFinishOrgCreationProps): [boolean, CheckoutStatus] {
  const router = useRouter();
  const { session_id } = router.query;

  const { isAuthenticated } = useAuthenticationStatus();
  const [loading, setLoading] = useState(false);
  const [postOrganizationRequest] = usePostOrganizationRequestMutation();
  const [status, setPostOrganizationRequestStatus] =
    useState<CheckoutStatus | null>(null);

  useEffect(() => {
    async function finishOrgCreation() {
      if (session_id && isAuthenticated) {
        setLoading(true);

        execPromiseWithErrorToast(
          async () => {
            const {
              data: { billingPostOrganizationRequest },
            } = await postOrganizationRequest({
              variables: {
                sessionID: session_id as string,
              },
            });

            const { Status } = billingPostOrganizationRequest;

            setLoading(false);
            setPostOrganizationRequestStatus(Status);

            switch (Status) {
              case CheckoutStatus.Completed:
                onCompleted(billingPostOrganizationRequest);
                break;

              case CheckoutStatus.Expired:
                onError();
                throw new Error('Request to create organization has expired');

              case CheckoutStatus.Open:
                // TODO discuss what to do in this case
                onError();
                throw new Error(
                  'Request to create organization with status "Open"',
                );

              default:
                break;
            }
          },
          {
            loadingMessage: 'Processing new organization request',
            successMessage:
              'The new organization has been created successfully.',
            errorMessage:
              'An error occurred while creating the new organization.',
            onError,
          },
        );
      }
    }
    finishOrgCreation();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session_id, isAuthenticated]);

  return [loading, status];
}

export default useFinishOrgCreation;
