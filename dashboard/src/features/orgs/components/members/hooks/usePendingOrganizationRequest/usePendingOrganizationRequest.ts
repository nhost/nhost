import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import {
  CheckoutStatus,
  type PostOrganizationRequestResponse,
  useOrganizationNewRequestsQuery,
  usePostOrganizationRequestMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';

export default function usePendingOrganizationRequest(): PostOrganizationRequestResponse | null {
  const userData = useUserData();
  const { route, query, isReady: isRouterReady } = useRouter();
  const { session_id } = query;
  const isPlatform = useIsPlatform();
  const hasUserId = isNotEmptyValue(userData?.id);

  const shouldCheck =
    isPlatform &&
    hasUserId &&
    !['/', '/orgs/verify'].includes(route) &&
    isRouterReady &&
    isEmptyValue(session_id);

  const { data: organizationNewRequestsData } = useOrganizationNewRequestsQuery(
    {
      variables: {
        userID: userData?.id ?? '',
      },
      skip: !shouldCheck,
    },
  );

  const sessionID =
    organizationNewRequestsData?.organizationNewRequests.at(0)?.sessionID;

  const [postOrganizationRequest, { data: postOrganizationRequestData }] =
    usePostOrganizationRequestMutation();

  useEffect(() => {
    if (!isNotEmptyValue(sessionID)) {
      return;
    }

    void postOrganizationRequest({
      variables: {
        sessionID,
      },
    });
  }, [sessionID, postOrganizationRequest]);

  const request = postOrganizationRequestData?.billingPostOrganizationRequest;

  if (shouldCheck && request?.Status === CheckoutStatus.Open) {
    return request;
  }

  return null;
}
