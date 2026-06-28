import { Switch } from '@/components/ui/v3/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ADMIN_ROLE } from './permissionState';

export interface HideEmptyTablesSwitchProps {
  selectedRole: string;
  hideEmpty: boolean;
  onHideEmptyChange: (value: boolean) => void;
}

export default function HideEmptyTablesSwitch({
  selectedRole,
  hideEmpty,
  onHideEmptyChange,
}: HideEmptyTablesSwitchProps) {
  const isAdmin = selectedRole === ADMIN_ROLE;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <Switch
            id="schema-diagram-hide-empty"
            checked={hideEmpty}
            onCheckedChange={onHideEmptyChange}
            disabled={isAdmin}
          />
          <label
            htmlFor="schema-diagram-hide-empty"
            className={
              isAdmin
                ? 'cursor-not-allowed text-muted-foreground text-xs opacity-50'
                : 'cursor-pointer text-xs'
            }
          >
            Hide tables without permissions
          </label>
        </div>
      </TooltipTrigger>
      {isAdmin ? (
        <TooltipContent>
          The admin role implicitly has access to all tracked tables. Select
          another role to filter.
        </TooltipContent>
      ) : null}
    </Tooltip>
  );
}
