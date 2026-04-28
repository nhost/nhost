import { useDialog } from '@/components/common/DialogProvider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';

export interface RoleActionSwitcherProps<A extends string> {
  role: string;
  action: A;
  availableRoles: string[];
  availableActions: A[];
  actionLabels: Record<A, string>;
  /**
   * Whether the surrounding form has unsaved changes. When true, changing
   * either dropdown opens the discard-confirmation dialog before applying.
   */
  isDirty: boolean;
  /**
   * Location passed to DialogProvider's onDirtyStateChange when the user
   * confirms discarding changes.
   */
  location?: 'drawer' | 'dialog';
  onRoleChange: (role: string) => void;
  onActionChange: (action: A) => void;
}

export default function RoleActionSwitcher<A extends string>({
  role,
  action,
  availableRoles,
  availableActions,
  actionLabels,
  isDirty,
  location,
  onRoleChange,
  onActionChange,
}: RoleActionSwitcherProps<A>) {
  const { openDirtyConfirmation, onDirtyStateChange } = useDialog();

  function guardedSwitch(apply: VoidFunction) {
    if (isDirty) {
      openDirtyConfirmation({
        props: {
          onPrimaryAction: () => {
            onDirtyStateChange(false, location);
            apply();
          },
        },
      });
      return;
    }
    apply();
  }

  return (
    <>
      <div className="grid grid-flow-col items-center gap-2">
        <label htmlFor="role-action-switcher-role" className="text-sm">
          Role:
        </label>
        <Select
          value={role}
          onValueChange={(newRole) =>
            guardedSwitch(() => onRoleChange(newRole))
          }
        >
          <SelectTrigger id="role-action-switcher-role" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableRoles.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-flow-col items-center gap-2">
        <label htmlFor="role-action-switcher-action" className="text-sm">
          Action:
        </label>
        <Select
          value={action}
          onValueChange={(newAction) =>
            guardedSwitch(() => onActionChange(newAction as A))
          }
        >
          <SelectTrigger id="role-action-switcher-action" className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableActions.map((a) => (
              <SelectItem key={a} value={a}>
                {actionLabels[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>
  );
}
