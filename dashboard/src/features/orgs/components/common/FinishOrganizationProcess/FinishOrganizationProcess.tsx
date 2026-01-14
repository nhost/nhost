import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { DialogDescription } from '@/components/ui/v3/dialog';
import { useFinishOrganizationProcess } from '@/features/orgs/hooks/useFinishOrganizationProcess';
import type { FinishOrgCreationOnCompletedCb } from '@/features/orgs/hooks/useFinishOrganizationProcess/useFinishOrganizationProcess';
import { CheckoutStatus } from '@/utils/__generated__/graphql';
import { memo } from 'react';

interface Props {
  onCompleted: FinishOrgCreationOnCompletedCb;
  onError?: () => void;
  successMessage: string;
  loadingMessage: string;
  errorMessage: string;
  pendingMessage: string;
  withDialogDescription?: boolean;
}

function FinishOrgCreationProcess({
  onCompleted,
  onError,
  successMessage,
  loadingMessage,
  errorMessage,
  pendingMessage,
  withDialogDescription,
}: Props) {
  const [loading, status] = useFinishOrganizationProcess({
    successMessage,
    loadingMessage,
    errorMessage,
    pendingMessage,
    onCompleted,
    onError,
  });
  let message: string | undefined;

  switch (status) {
    case CheckoutStatus.Completed: {
      message = successMessage;
      break;
    }
    case CheckoutStatus.Expired: {
      message = errorMessage;
      break;
    }
    case CheckoutStatus.Open: {
      message = pendingMessage;
      break;
    }
    default:
      message = loadingMessage;
  }

  const Component = withDialogDescription ? DialogDescription : 'span';

  return (
    <div className="relative flex flex-auto overflow-x-hidden">
      <div className="flex h-full w-full flex-col items-center justify-center space-y-2">
        {(loading || status === CheckoutStatus.Completed) && (
          <ActivityIndicator circularProgressProps={{ className: 'w-6 h-6' }} />
        )}
        <Component data-testid="message">{message}</Component>
      </div>
    </div>
  );
}

export default memo(FinishOrgCreationProcess);
