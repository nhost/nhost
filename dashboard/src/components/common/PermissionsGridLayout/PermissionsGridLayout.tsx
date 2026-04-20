import type { ReactNode } from 'react';
import { NavLink } from '@/components/common/NavLink';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
import { FullPermissionIcon } from '@/components/ui/v3/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v3/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v3/icons/PartialPermissionIcon';
import InfoAlert from '@/features/orgs/components/InfoAlert/InfoAlert';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export interface PermissionsGridLayoutProps {
  onCancel?: VoidFunction;
  children: ReactNode;
}

export default function PermissionsGridLayout({
  onCancel,
  children,
}: PermissionsGridLayoutProps) {
  const { org } = useCurrentOrg();
  const { project } = useProject();

  return (
    <div className="flex flex-auto flex-col content-between overflow-hidden border-t-1 bg-[#fafafa] dark:bg-[#151a22]">
      <div className="flex-auto overflow-y-auto">
        <div className="grid grid-flow-row content-start gap-6 border-b-1 bg-white p-6 dark:bg-[#171d26]">
          <div className="grid grid-flow-row gap-2">
            <h2 className="font-bold text-sm+">Roles & Actions overview</h2>
            <p className="text-muted-foreground text-sm">
              Rules for each role and action can be set by clicking on the
              corresponding cell.
            </p>
          </div>

          <div className="grid grid-flow-col items-center justify-start gap-4">
            <span className="grid grid-flow-col items-center gap-1 text-sm">
              full access <FullPermissionIcon />
            </span>
            <span className="grid grid-flow-col items-center gap-1 text-sm">
              partial access <PartialPermissionIcon />
            </span>
            <span className="grid grid-flow-col items-center gap-1 text-sm">
              no access <NoPermissionIcon />
            </span>
          </div>

          {children}

          <InfoAlert>
            Please go to the{' '}
            <NavLink
              href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/roles-and-permissions`}
              underline="hover"
              className="px-0"
            >
              Settings page
            </NavLink>{' '}
            to add and delete roles.
          </InfoAlert>
        </div>
      </div>

      <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 p-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
