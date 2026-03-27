import { useMemo } from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import useAvailableScopes from '@/features/orgs/projects/authentication/oauth2/useAvailableScopes';
import { cn } from '@/lib/utils';
import { useGetRemoteAppRolesQuery } from '@/utils/__generated__/graphql';

interface ScopePickerProps {
  selected: Set<string>;
  onChange: (scopes: Set<string>) => void;
  disabled?: boolean;
}

const GRAPHQL_ROLE_PREFIX = 'graphql:role:';

export default function ScopePicker({
  selected,
  onChange,
  disabled,
}: ScopePickerProps) {
  const { scopes: standardScopes } = useAvailableScopes();
  const client = useRemoteApplicationGQLClient();
  const { data: rolesData } = useGetRemoteAppRolesQuery({ client });

  const roleScopes = useMemo(() => {
    const roles = rolesData?.authRoles ?? [];

    return roles.map((r) => `${GRAPHQL_ROLE_PREFIX}${r.role}`);
  }, [rolesData]);

  const allScopes = useMemo(() => {
    const combined = [...standardScopes, ...roleScopes];
    const seen = new Set(combined);

    for (const s of selected) {
      if (s.startsWith(GRAPHQL_ROLE_PREFIX) && !seen.has(s)) {
        combined.push(s);
        seen.add(s);
      }
    }

    return combined;
  }, [standardScopes, roleScopes, selected]);

  function toggleScope(scope: string) {
    if (disabled) {
      return;
    }
    const next = new Set(selected);
    if (next.has(scope)) {
      next.delete(scope);
    } else {
      next.add(scope);
    }
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {standardScopes.map((scope) => {
          const isSelected = selected.has(scope);
          return (
            <Badge
              key={scope}
              variant={isSelected ? 'default' : 'outline'}
              className={cn(
                'cursor-pointer select-none px-3 py-1 text-xs transition-opacity',
                !isSelected && 'opacity-50',
                disabled && 'pointer-events-none',
              )}
              onClick={() => toggleScope(scope)}
            >
              {scope}
            </Badge>
          );
        })}
      </div>
      {roleScopes.length > 0 && (
        <div>
          <p className="mb-1.5 text-muted-foreground text-xs">
            Role-specific GraphQL scopes
          </p>
          <div className="flex flex-wrap gap-2">
            {allScopes
              .filter((s) => s.startsWith(GRAPHQL_ROLE_PREFIX))
              .map((scope) => {
                const isSelected = selected.has(scope);
                return (
                  <Badge
                    key={scope}
                    variant={isSelected ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer select-none px-3 py-1 text-xs transition-opacity',
                      !isSelected && 'opacity-50',
                      disabled && 'pointer-events-none',
                    )}
                    onClick={() => toggleScope(scope)}
                  >
                    {scope}
                  </Badge>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
