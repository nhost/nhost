import { Trash } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui/v3/button';
import useRemoveSecurityKey from '@/features/account/settings/components/SecurityKeysSettings/hooks/useRemoveSecurityKey';

interface Props {
  id: string;
}

function RemoveSecurityKeyButton({ id }: Props) {
  const removeSecurityKey = useRemoveSecurityKey();

  function handleClick() {
    removeSecurityKey(id);
  }

  return (
    <Button
      variant="subtle"
      size="sm"
      onClick={handleClick}
      aria-label={`Remove security key ${id}`}
    >
      <Trash />
    </Button>
  );
}

export default memo(RemoveSecurityKeyButton);
