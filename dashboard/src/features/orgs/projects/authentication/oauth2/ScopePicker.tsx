import { Badge } from '@/components/ui/v3/badge';
import useAvailableScopes from '@/features/orgs/projects/authentication/oauth2/useAvailableScopes';
import { cn } from '@/lib/utils';

interface ScopePickerProps {
  selected: Set<string>;
  onChange: (scopes: Set<string>) => void;
  disabled?: boolean;
}

export default function ScopePicker({
  selected,
  onChange,
  disabled,
}: ScopePickerProps) {
  const { scopes } = useAvailableScopes();

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
    <div className="flex flex-wrap gap-2">
      {scopes.map((scope) => {
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
  );
}
