'use client';

import { BaseLayout } from '@/components/layout/BaseLayout';
import { Header } from '@/components/layout/Header';
import { FinishOrgCreationProcess } from '@/features/orgs/components/common/FinishOrgCreationProcess';
import { useFinishOrgCreation } from '@/features/orgs/hooks/useFinishOrgCreation';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import type { PostOrganizationRequestMutation } from '@/utils/__generated__/graphql';
import { useAuthenticationStatus } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useCallback, useEffect } from 'react';

export default function PostCheckout() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading } = useAuthenticationStatus();

  useEffect(() => {
    if (!isPlatform || isLoading || isAuthenticated) {
      return;
    }

    router.push('/signin');
  }, [isLoading, isAuthenticated, router, isPlatform]);

  const onCompleted = useCallback(
    (
      data: PostOrganizationRequestMutation['billingPostOrganizationRequest'],
    ) => {
      const { Slug } = data;
      router.push(`/orgs/${Slug}/projects`);
    },
    [router],
  );

  const [loading, status] = useFinishOrgCreation({ onCompleted });

  return (
    <BaseLayout className="flex h-screen flex-col">
      <Header className="flex py-1" />
      <div className="flex h-screen w-full flex-col">
        <FinishOrgCreationProcess
          loading={loading}
          status={status}
          loadingMessage="Processing new organization request"
          successMessage="Organization created successfully. Redirecting..."
          pendingMessage="Organization creation is pending..."
          errorMessage="Error occurred while creating the organization. Please try again."
        />
      </div>
    </BaseLayout>
  );
}
