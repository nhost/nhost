import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useAuth } from '@/providers/Auth';
import {
  CheckoutStatus,
  type PostOrganizationRequestMutation,
  usePostOrganizationRequestMutation,
} from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export type FinishOrgCreationOnCompletedCb = (
  data: PostOrganizationRequestMutation['billingPostOrganizationRequest'],
) => void;

interface UseFinishOrgCreationProps {
  successMessage: string;
  loadingMessage: string;
  errorMessage: string;
  pendingMessage: string;
  onCompleted: FinishOrgCreationOnCompletedCb;
  onError?: () => void;
}

function useFinishOrgCreation({
  successMessage,
  loadingMessage,
  errorMessage,
  pendingMessage,
  onCompleted,
  onError,
}: UseFinishOrgCreationProps): [boolean, CheckoutStatus] {
  const router = useRouter();
  const { session_id } = router.query;

  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [postOrganizationRequest] = usePostOrganizationRequestMutation();
  const [status, setPostOrganizationRequestStatus] =
    useState<CheckoutStatus | null>(null);

  useEffect(() => {
    async function finishOrgCreation() {
      if (router.isReady && session_id && isAuthenticated) {
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
                throw new Error('Organization request has expired');

              case CheckoutStatus.Open:
                // TODO discuss what to do in this case
                onError();
                throw new Error(pendingMessage);

              default:
                break;
            }
          },
          {
            loadingMessage:
              loadingMessage || 'Processing new organization request',
            successMessage:
              successMessage ||
              'The new organization has been created successfully.',
            errorMessage:
              errorMessage ||
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
