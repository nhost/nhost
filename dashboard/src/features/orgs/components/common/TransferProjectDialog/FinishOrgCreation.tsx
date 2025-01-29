import { FinishOrgCreationProcess } from '@/features/orgs/components/common/FinishOrgCreationProcess';
import { useFinishOrgCreation } from '@/features/orgs/hooks/useFinishOrgCreation';
import { type FinishOrgCreationOnCompletedCb } from '@/features/orgs/hooks/useFinishOrgCreation/useFinishOrgCreation';

interface Props {
  onCompleted: FinishOrgCreationOnCompletedCb;
  onError: () => void;
}

function FinishOrgCreation({ onCompleted, onError }: Props) {
  const [loading, status] = useFinishOrgCreation({ onCompleted, onError });
  return (
    <FinishOrgCreationProcess
      loading={loading}
      status={status}
      loadingMessage="Processing new organization request"
      successMessage="Organization created successfully."
      pendingMessage="Organization creation is pending..."
      errorMessage="Error occurred while creating the organization. Please try again."
    />
  );
}

export default FinishOrgCreation;
