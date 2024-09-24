import { BaseLayout } from '@/components/layout/BaseLayout';
import { Header } from '@/components/layout/Header';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import {
  CheckoutStatus,
  useGetOrganizationByIdLazyQuery,
  usePostOrganizationRequestMutation,
} from '@/utils/__generated__/graphql';
import { useAuthenticationStatus } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function PostCheckout() {
  const router = useRouter();
  const { session_id } = router.query;
  const isPlatform = useIsPlatform();

  const [loading, setLoading] = useState(false);
  const [postOrganizationRequest] = usePostOrganizationRequestMutation();
  const { isAuthenticated, isLoading } = useAuthenticationStatus();

  const [fetchOrg] = useGetOrganizationByIdLazyQuery();
  const [postOrganizationRequestStatus, setPostOrganizationRequestStatus] =
    useState<CheckoutStatus | null>(null);

  useEffect(() => {
    if (!isPlatform || isLoading || isAuthenticated) {
      return;
    }

    router.push('/signin');
  }, [isLoading, isAuthenticated, router, isPlatform]);

  useEffect(() => {
    const redirectToOrg = async (orgId: string) => {
      try {
        const { data } = await fetchOrg({
          variables: { orgId },
        });

        const orgSlug = data?.organizations?.[0]?.slug;

        if (!orgSlug) {
          throw new Error('Organization not found or missing slug');
        }

        await router.push(`/orgs/${orgSlug}/projects`);
      } catch (error) {
        console.error('Error redirecting to organization:', error);
      }
    };

    (async () => {
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

            const { Status, OrganizationID } = billingPostOrganizationRequest;

            setLoading(false);
            setPostOrganizationRequestStatus(Status);

            switch (Status) {
              case CheckoutStatus.Completed:
                redirectToOrg(OrganizationID);
                break;

              case CheckoutStatus.Expired:
                throw new Error('Request to create organization has expired');

              case CheckoutStatus.Open:
                // TODO discuss what to do in this case
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
          },
        );
      }
    })();
  }, [session_id, postOrganizationRequest, router, fetchOrg, isAuthenticated]);

  return (
    <BaseLayout className="flex h-screen flex-col">
      <Header className="flex py-1" />
      <div className="flex h-screen w-full flex-col">
        <RetryableErrorBoundary errorMessageProps={{ className: 'pt-20' }}>
          <div className="relative flex flex-auto overflow-x-hidden">
            {loading && (
              <div className="flex h-full w-full flex-col items-center justify-center space-y-2">
                <ActivityIndicator
                  circularProgressProps={{ className: 'w-6 h-6' }}
                />
                <span>Processing new organization request</span>
              </div>
            )}

            {!loading &&
              postOrganizationRequestStatus === CheckoutStatus.Completed && (
                <div className="flex h-full w-full flex-col items-center justify-center space-y-2">
                  <ActivityIndicator
                    circularProgressProps={{ className: 'w-6 h-6' }}
                  />
                  <span>Organization created successfully. Redirecting...</span>
                </div>
              )}

            {!loading &&
              postOrganizationRequestStatus === CheckoutStatus.Expired && (
                <div className="flex h-full w-full flex-col items-center justify-center space-y-2">
                  <span>
                    Error occurred while creating the organization. Please try
                    again.
                  </span>
                </div>
              )}

            {!loading &&
              postOrganizationRequestStatus === CheckoutStatus.Open && (
                <div className="flex h-full w-full flex-col items-center justify-center space-y-2">
                  <span>Organization creation is pending...</span>
                </div>
              )}
          </div>
        </RetryableErrorBoundary>
      </div>
    </BaseLayout>
  );
}
