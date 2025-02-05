import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { CheckoutStatus } from '@/utils/__generated__/graphql';
import { memo } from 'react';

interface Props {
  loading: boolean;
  status: CheckoutStatus | null;
  successMessage: string;
  loadingMessage: string;
  errorMessage: string;
  pendingMessage: string;
}

function FinishOrgCreationProcess({
  loading,
  status,
  successMessage,
  loadingMessage,
  errorMessage,
  pendingMessage,
}: Props) {
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

  return (
    <div className="relative flex flex-auto overflow-x-hidden">
      <div className="flex h-full w-full flex-col items-center justify-center space-y-2">
        {(loading || status === CheckoutStatus.Completed) && (
          <ActivityIndicator circularProgressProps={{ className: 'w-6 h-6' }} />
        )}
        <span>{message}</span>
      </div>
    </div>
  );
}

export default memo(FinishOrgCreationProcess);
