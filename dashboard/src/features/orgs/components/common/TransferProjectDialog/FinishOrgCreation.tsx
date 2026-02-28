import { FinishOrganizationProcess } from '@/features/orgs/components/common/FinishOrganizationProcess';
import type { FinishOrgCreationOnCompletedCb } from '@/features/orgs/hooks/useFinishOrganizationProcess/useFinishOrganizationProcess';

interface Props {
  onCompleted: FinishOrgCreationOnCompletedCb;
  onError: () => void;
}

function FinishOrgCreation({ onCompleted, onError }: Props) {
  return (
    <FinishOrganizationProcess
      onCompleted={onCompleted}
      onError={onError}
      loadingMessage="Creating new organization"
      successMessage="Organization created successfully."
      pendingMessage="Organization creation is pending..."
      errorMessage="Error occurred while creating the organization. Please try again."
      withDialogDescription
    />
  );
}

export default FinishOrgCreation;
