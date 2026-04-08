import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { DataBrowserSidebarFilterType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
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

interface DatabaseObjectTypeFilterBarProps {
  availableTypes: DataBrowserSidebarFilterType[];
  activeFilters: Set<DataBrowserSidebarFilterType>;
  onToggleFilter: (type: DataBrowserSidebarFilterType) => void;
}

export default function DatabaseObjectTypeFilterBar({
  availableTypes,
  activeFilters,
  onToggleFilter,
}: DatabaseObjectTypeFilterBarProps) {
  return (
    <div className="flex items-center gap-0.5 px-1">
      {availableTypes.map((type) => {
        const isEnum = type === 'ENUM';
        const Icon = getDatabaseObjectIcon(
          isEnum ? 'ORDINARY TABLE' : type,
          isEnum,
        );
        const isActive = activeFilters.has(type);

        return (
          <Tooltip key={type}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className={cn('h-7 w-7', {
                  'bg-accent': isActive,
                  'opacity-40': !isActive,
                })}
                onClick={() => onToggleFilter(type)}
              >
                <Icon className="h-3.5 w-3.5 text-blue-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              {filterLabels[type]}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
