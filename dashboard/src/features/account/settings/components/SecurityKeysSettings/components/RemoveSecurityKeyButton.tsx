import { Trash2 } from 'lucide-react';
import { memo } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="subtle"
          onClick={handleClick}
          aria-label={`Remove passkey ${id}`}
          className="hover:text-destructive dark:hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Delete</TooltipContent>
    </Tooltip>
  );
}

export default memo(RemoveSecurityKeyButton);
