import { Trash } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui/v3/button';
import useRemoveSecurityKey from '@/features/account/settings/components/SecurityKeysSettings/hooks/useRemoveSecurityKey';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

interface Props {
  id: string;
}

function RemoveSecurityKeyButton({ id }: Props) {
  const removeSecurityKey = useRemoveSecurityKey();

  function handleClick() {
    execPromiseWithErrorToast(async () => removeSecurityKey(id), {
      loadingMessage: 'Removing security key...',
      successMessage: 'Security key has been removed successfully.',
      errorMessage:
        'An error occurred while trying to remove security key. Please try again.',
    });
  }

  return (
    <Button
      variant="ghost"
      onClick={handleClick}
      aria-label={`Remove security key ${id}`}
    >
      <Trash />
    </Button>
  );
}

export default memo(RemoveSecurityKeyButton);
