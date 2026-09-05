import { useCallback } from 'react';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useBillingOrganizationCustomePortalLazyQuery } from '@/generated/graphql';

export interface UseCustomerPortalResult {
  openCustomerPortal: () => Promise<void>;
  loading: boolean;
}

export default function useCustomerPortal(): UseCustomerPortalResult {
  const { org } = useCurrentOrg();
  const [fetchCustomerPortalLink, { loading }] =
    useBillingOrganizationCustomePortalLazyQuery();

  const openCustomerPortal = useCallback(async (): Promise<void> => {
    await execPromiseWithErrorToast(
      async () => {
        if (!org?.id) {
          throw new Error('Could not fetch customer portal link');
        }

        const { data: { billingOrganizationCustomePortal = null } = {} } =
          await fetchCustomerPortalLink({
            variables: {
              organizationID: org.id,
            },
          });

        if (!billingOrganizationCustomePortal) {
          throw new Error('Could not fetch customer portal link');
        }

        const customerPortalWindow = window.open(
          billingOrganizationCustomePortal,
        );
        if (!customerPortalWindow) {
          window.location.href = billingOrganizationCustomePortal;
        }
      },
      {
        loadingMessage: 'Processing',
        successMessage: 'Redirecting to customer portal',
        errorMessage:
          'An error occurred while redirecting to customer portal! Please try again',
      },
    );
  }, [fetchCustomerPortalLink, org?.id]);

  return { openCustomerPortal, loading };
}
