import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import { type FinishOrgCreationOnCompletedCb } from '@/features/orgs/hooks/useFinishOrganizationProcess/useFinishOrganizationProcess';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { isNotEmptyValue } from '@/lib/utils';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import FinishOrgCreation from './FinishOrgCreation';
import TransferProjectForm, {
  type TransferProjectFormProps,
} from './TransferProjectForm';

interface Props extends TransferProjectFormProps {
  onFinishOrgCreationCompleted: () => void;
  onFinishOrgError: () => void;
}

function TransferProjectDialogContent({
  onCreateNewOrg,
  onCancel,
  onFinishOrgCreationCompleted,
  onFinishOrgError,
  selectedOrganizationId,
  onOrganizationChange,
}: Props) {
  const { query, replace, pathname } = useRouter();
  const { session_id, ...remainingQuery } = query;
  const { refetch: refetchOrgs } = useOrgs();
  const [showContent, setShowContent] = useState(true);

  const removeSessionIdFromQuery = useCallback(() => {
    replace({ pathname, query: remainingQuery }, undefined, {
      shallow: true,
    });
  }, [replace, remainingQuery, pathname]);

  useEffect(() => {
    if (isNotEmptyValue(session_id)) {
      setShowContent(false);
    }
  }, [session_id]);

  const handleOnCompleted: FinishOrgCreationOnCompletedCb = useCallback(
    async ({ Slug }) => {
      removeSessionIdFromQuery();
      const {
        data: { organizations },
      } = await refetchOrgs();

      const newOrg = organizations.find((org) => org.slug === Slug);

      setShowContent(true);
      onOrganizationChange(newOrg.id);
      onFinishOrgCreationCompleted();
    },
    [
      onFinishOrgCreationCompleted,
      refetchOrgs,
      removeSessionIdFromQuery,
      onOrganizationChange,
    ],
  );

  return (
    <>
      <DialogHeader className="flex gap-2">
        <DialogTitle>
          Move the current project to a different organization.
        </DialogTitle>
      </DialogHeader>
      {showContent ? (
        <>
          <DialogDescription>
            To transfer a project between organizations, you must be an{' '}
            <span className="font-bold">ADMIN</span> in both.
            <br />
            When transferred to a new organization, the project will adopt that
            organization’s plan.
          </DialogDescription>
          <TransferProjectForm
            onCreateNewOrg={onCreateNewOrg}
            selectedOrganizationId={selectedOrganizationId}
            onCancel={onCancel}
            onOrganizationChange={onOrganizationChange}
          />
        </>
      ) : (
        <FinishOrgCreation
          onCompleted={handleOnCompleted}
          onError={onFinishOrgError}
        />
      )}
    </>
  );
}

export default TransferProjectDialogContent;
