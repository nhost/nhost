'use client';

import { BaseLayout } from '@/components/layout/BaseLayout';
import { Header } from '@/components/layout/Header';
import { FinishOrgCreationProcess } from '@/features/orgs/components/common/FinishOrgCreationProcess';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useUserData } from '@/hooks/useUserData';
import { analytics } from '@/lib/segment';
import { useAuth } from '@/providers/Auth';
import type { PostOrganizationRequestMutation } from '@/utils/__generated__/graphql';
import { useGetOrganizationLazyQuery } from '@/utils/__generated__/graphql';
import { useRouter } from 'next/router';
import { useCallback, useEffect } from 'react';

export default function PostCheckout() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading } = useAuth();
  const currentUser = useUserData();
  const [getOrganizations] = useGetOrganizationLazyQuery();

  useEffect(() => {
    if (!isPlatform || isLoading || isAuthenticated) {
      return;
    }

    router.push('/signin');
  }, [isLoading, isAuthenticated, router, isPlatform]);

  const onCompleted = useCallback(
    async (
      data: PostOrganizationRequestMutation['billingPostOrganizationRequest'],
    ) => {
      const { Slug } = data;

      const { data: orgData } = await getOrganizations({
        variables: {
          orgSlug: Slug,
        },
      });

      const { id, name, slug, plan } = orgData.organizations[0];
      analytics.track('Organization Created', {
        organizationId: id,
        organizationSlug: slug,
        organizationName: name,
        organizationPlan: plan?.name,
        organizationOwnerId: currentUser?.id,
        organizationOwnerEmail: currentUser?.email,
      });

      router.push(`/orgs/${Slug}/projects`);
    },
    [router, currentUser?.email, currentUser?.id, getOrganizations],
  );

  return (
    <BaseLayout className="flex h-screen flex-col">
      <Header className="flex py-1" />
      <div className="flex h-screen w-full flex-col">
        <FinishOrgCreationProcess
          onCompleted={onCompleted}
          loadingMessage="Processing new organization request"
          successMessage="Organization created successfully. Redirecting..."
          pendingMessage="Organization creation is pending..."
          errorMessage="Error occurred while creating the organization. Please try again."
        />
      </div>
    </BaseLayout>
  );
}
