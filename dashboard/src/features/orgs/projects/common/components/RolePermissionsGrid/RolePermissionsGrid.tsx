import type { ReactNode } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/v3/collapsible';
import { FullPermissionIcon } from '@/components/ui/v3/icons/FullPermissionIcon';
import { NoPermissionIcon } from '@/components/ui/v3/icons/NoPermissionIcon';
import { PartialPermissionIcon } from '@/components/ui/v3/icons/PartialPermissionIcon';
import { Spinner } from '@/components/ui/v3/spinner';
import { cn } from '@/lib/utils';

export type RolePermissionAccess = 'allowed' | 'partial' | 'not-allowed';

export interface RolePermissionRow {
  /**
   * Role shown in the left column.
   */
  role: string;
  /**
   * Visual access state — determines which icon is rendered.
   */
  access: RolePermissionAccess;
  /**
   * Whether the role currently holds the permission. Drives the confirm
   * button (Allow vs Delete Permissions) and the toggle direction.
   */
  hasPermission: boolean;
  /**
   * When false, the row renders a static icon with no toggle. Used for the
   * admin row and read-only modes. Defaults to true.
   */
  interactive?: boolean;
  /**
   * Sentence shown in the expanded confirm panel.
   */
  confirmDescription?: ReactNode;
}

export interface RolePermissionsGridProps {
  rows: RolePermissionRow[];
  /**
   * Role whose confirm panel is currently expanded, or null.
   */
  expandedRole: string | null;
  /**
   * Called when a row is expanded or collapsed.
   */
  onExpandedRoleChange: (role: string | null) => void;
  /**
   * Called when the user confirms a change for a role. `nextHasPermission`
   * is whether the role should be granted (true) or revoked (false).
   */
  onToggle: (role: string, nextHasPermission: boolean) => void;
  /**
   * Whether a mutation is in flight — disables the confirm buttons and shows
   * a spinner on the active one.
   */
  isMutating?: boolean;
}

function PermissionIcon({ access }: { access: RolePermissionAccess }) {
  switch (access) {
    case 'allowed':
      return <FullPermissionIcon />;
    case 'partial':
      return <PartialPermissionIcon />;
    default:
      return <NoPermissionIcon />;
  }
}

export default function RolePermissionsGrid({
  rows,
  expandedRole,
  onExpandedRoleChange,
  onToggle,
  isMutating,
}: RolePermissionsGridProps) {
  return (
    <div>
      <div className="grid grid-cols-2 items-center">
        <span className="p-2 text-muted-foreground text-sm">Role</span>
        <span className="p-2 text-center text-muted-foreground text-sm">
          Permission
        </span>
      </div>

      <div className="rounded-sm border">
        {rows.map((row, index) => {
          const isLast = index === rows.length - 1;
          const isInteractive = row.interactive !== false;

          if (!isInteractive) {
            return (
              <div
                key={row.role}
                className={cn(
                  'grid grid-cols-2 items-center',
                  !isLast && 'border-b',
                )}
              >
                <span className="truncate border-r p-2 text-sm">
                  {row.role}
                </span>
                <span className="inline-grid items-center justify-center text-center">
                  <PermissionIcon access={row.access} />
                </span>
              </div>
            );
          }

          const isExpanded = expandedRole === row.role;

          return (
            <Collapsible
              key={row.role}
              open={isExpanded}
              onOpenChange={(open) =>
                onExpandedRoleChange(open ? row.role : null)
              }
              className={cn(!isLast && 'border-b')}
            >
              <div className="grid grid-cols-2 items-center">
                <span className="truncate border-r p-2 text-sm">
                  {row.role}
                </span>
                <span className="inline-grid h-full w-full items-center p-0 text-center">
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className="flex h-full w-full items-center justify-center rounded-none p-2 hover:bg-muted/50"
                    >
                      <PermissionIcon access={row.access} />
                    </button>
                  </CollapsibleTrigger>
                </span>
              </div>
              <CollapsibleContent>
                <div className="border-t bg-muted/30 p-4">
                  <div className="flex flex-col gap-3">
                    {row.confirmDescription && (
                      <p className="text-sm">{row.confirmDescription}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onExpandedRoleChange(null)}
                        disabled={isMutating}
                      >
                        Cancel
                      </Button>

                      <Button
                        variant={row.hasPermission ? 'outline' : 'default'}
                        size="sm"
                        className={cn(
                          row.hasPermission &&
                            'border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive',
                        )}
                        onClick={() => onToggle(row.role, !row.hasPermission)}
                        disabled={isMutating}
                      >
                        {isMutating ? (
                          <Spinner className="h-4 w-4" />
                        ) : row.hasPermission ? (
                          'Delete Permissions'
                        ) : (
                          'Allow'
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
