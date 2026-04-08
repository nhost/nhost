import { X } from 'lucide-react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { DataBrowserSidebarFilterType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { getDatabaseObjectColor } from '@/features/orgs/projects/database/dataGrid/utils/getDatabaseObjectColor';
import { getDatabaseObjectIcon } from '@/features/orgs/projects/database/dataGrid/utils/getDatabaseObjectIcon';
import { cn } from '@/lib/utils';

const filterLabels: Record<DataBrowserSidebarFilterType, string> = {
  'ORDINARY TABLE': 'Table',
  VIEW: 'View',
  'MATERIALIZED VIEW': 'Materialized View',
  'FOREIGN TABLE': 'Foreign Table',
  FUNCTION: 'Function',
  ENUM: 'Enum',
};

const allFilters: DataBrowserSidebarFilterType[] = [
  'ORDINARY TABLE',
  'ENUM',
  'VIEW',
  'MATERIALIZED VIEW',
  'FUNCTION',
  'FOREIGN TABLE',
];

interface DatabaseObjectTypeFilterBarProps {
  activeFilters: Set<DataBrowserSidebarFilterType>;
  onToggleFilter: (type: DataBrowserSidebarFilterType) => void;
  onClear: () => void;
}

export default function DatabaseObjectTypeFilterBar({
  activeFilters,
  onToggleFilter,
  onClear,
}: DatabaseObjectTypeFilterBarProps) {
  const hasActiveFilters = activeFilters.size > 0;

  return (
    <div className="flex w-full items-center gap-0.5 px-1">
      {allFilters.map((filterType) => {
        const isEnum = filterType === 'ENUM';
        const type = isEnum ? 'ORDINARY TABLE' : filterType;
        const Icon = getDatabaseObjectIcon(type, isEnum);
        const isActive = activeFilters.has(filterType);
        const typeColor = getDatabaseObjectColor(type, isEnum);

        return (
          <Tooltip key={filterType}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', {
                  'bg-accent': isActive,
                  'opacity-40': !isActive,
                })}
                onClick={() => onToggleFilter(filterType)}
              >
                <Icon className={cn('h-3.5 w-3.5', typeColor)} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={0}>
              {filterLabels[filterType]}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {hasActiveFilters && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={onClear}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            Clear filters
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}
