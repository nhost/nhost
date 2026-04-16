import { X } from 'lucide-react';
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

const allFilters: DataBrowserSidebarFilterType[] = [
  'ORDINARY TABLE',
  'ENUM',
  'VIEW',
  'FUNCTION',
  'FOREIGN TABLE',
];

interface DatabaseObjectTypeFilterBarProps {
  activeFilters: Set<DataBrowserSidebarFilterType>;
  onToggleFilter: (type: DataBrowserSidebarFilterType) => void;
  onClear: () => void;
}

function FilterButton({
  filterType,
  isActive,
  hasActiveFilters,
  onToggle,
}: {
  filterType: DataBrowserSidebarFilterType;
  isActive: boolean;
  hasActiveFilters: boolean;
  onToggle: () => void;
}) {
  const isEnum = filterType === 'ENUM';
  const type = isEnum ? 'ORDINARY TABLE' : filterType;
  const Icon = getDatabaseObjectIcon(type, isEnum);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Toggle filter by ${filterLabels[filterType]}`}
          className={cn('h-7 w-7', {
            'bg-accent ring-1 ring-ring/50': isActive,
            'opacity-30': !isActive && hasActiveFilters,
          })}
          onClick={onToggle}
        >
          <Icon className="h-3.5 w-3.5 text-primary" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        {filterLabels[filterType]}
      </TooltipContent>
    </Tooltip>
  );
}

export default function DatabaseObjectTypeFilterBar({
  activeFilters,
  onToggleFilter,
  onClear,
}: DatabaseObjectTypeFilterBarProps) {
  const hasActiveFilters = activeFilters.size > 0;

  return (
    <div className="flex w-full flex-col gap-1 px-1">
      <span className="text-muted-foreground text-xs">
        {hasActiveFilters ? 'Filter by:' : 'Showing all types'}
      </span>
      <div className="flex items-center gap-0.5">
        {allFilters.map((filterType) => (
          <FilterButton
            key={filterType}
            filterType={filterType}
            isActive={activeFilters.has(filterType)}
            hasActiveFilters={hasActiveFilters}
            onToggle={() => onToggleFilter(filterType)}
          />
        ))}
        {hasActiveFilters && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={onClear}
              >
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              Clear filters
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
