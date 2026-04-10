import { FullPermissionIcon } from '@/components/ui/v2/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v2/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v2/icons/PartialPermissionIcon';

export default function PermissionsLegend() {
  return (
    <div className="grid grid-flow-col items-center justify-start gap-4 font-medium text-muted-foreground text-xs">
      <span className="grid grid-flow-col items-center gap-1">
        full access <FullPermissionIcon />
      </span>

      <span className="grid grid-flow-col items-center gap-1">
        partial access <PartialPermissionIcon />
      </span>

      <span className="grid grid-flow-col items-center gap-1">
        no access <NoPermissionIcon />
      </span>
    </div>
  );
}
