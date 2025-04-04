import { FinishOrgCreationProcess } from '@/features/orgs/components/common/FinishOrgCreationProcess';
import { type FinishOrgCreationOnCompletedCb } from '@/features/orgs/hooks/useFinishOrgCreation/useFinishOrgCreation';

interface Props {
  onCompleted: FinishOrgCreationOnCompletedCb;
  onError: () => void;
}

function FinishOrgCreation({ onCompleted, onError }: Props) {
  return (
    <FinishOrgCreationProcess
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
