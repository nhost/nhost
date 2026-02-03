import { Hash, Info, Key, Link2, ShieldCheck, Zap } from 'lucide-react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { Spinner } from '@/components/ui/v3/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useTableRelatedObjectsQuery } from '@/features/orgs/projects/database/dataGrid/hooks/useTableRelatedObjectsQuery';
import { cn } from '@/lib/utils';

export interface TableInfoBarProps {
  /**
   * Callback when user wants to see full table info.
   */
  onViewFullInfo?: () => void;
}

interface InfoBadgeProps {
  icon: React.ReactNode;
  count: number;
  label: string;
  items: Array<{ name: string; detail?: string }>;
  colorClass?: string;
}

function InfoBadge({
  icon,
  count,
  label,
  items,
  colorClass = 'text-muted-foreground',
}: InfoBadgeProps) {
  if (count === 0) {
    return null;
  }

  return (
    <Popover>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-7 gap-1.5 px-2 text-xs font-medium',
                  colorClass,
                )}
              >
                {icon}
                <span>{count}</span>
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="bottom">
            <p>
              {count} {label}
              {count !== 1 ? 's' : ''}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="start" className="w-64 p-0">
        <div className="border-b px-3 py-2">
          <h4 className="font-medium text-sm">
            {label}
            {count !== 1 ? 's' : ''} ({count})
          </h4>
        </div>
        <div className="max-h-48 overflow-y-auto p-2">
          <ul className="space-y-1">
            {items.map((item) => (
              <li
                key={item.name}
                className="rounded px-2 py-1 text-xs hover:bg-muted"
              >
                <span className="font-medium">{item.name}</span>
                {item.detail && (
                  <span className="ml-1 text-muted-foreground">
                    {item.detail}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default function TableInfoBar({ onViewFullInfo }: TableInfoBarProps) {
  const router = useRouter();
  const { dataSourceSlug, schemaSlug, tableSlug } = router.query;

  const schema = schemaSlug as string;
  const table = tableSlug as string;
  const dataSource = (dataSourceSlug as string) || 'default';

  const currentPath =
    dataSource && schema && table ? `${dataSource}.${schema}.${table}` : '';

  const { data, status } = useTableRelatedObjectsQuery(
    ['table-info-bar', currentPath],
    {
      schema,
      table,
      dataSource,
      queryOptions: {
        enabled: !!currentPath && !!table,
        staleTime: 30000, // Cache for 30 seconds
      },
    },
  );

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 px-2">
        <Spinner className="h-3 w-3" />
        <span className="text-muted-foreground text-xs">Loading info...</span>
      </div>
    );
  }

  if (!data || data.error) {
    return null;
  }

  const { constraints, triggers, indexes } = data;

  // Group constraints
  const primaryKeys = constraints.filter((c) => c.type === 'PRIMARY KEY');
  const foreignKeys = constraints.filter((c) => c.type === 'FOREIGN KEY');
  const uniqueConstraints = constraints.filter((c) => c.type === 'UNIQUE');
  const checkConstraints = constraints.filter((c) => c.type === 'CHECK');

  const hasAnyInfo =
    primaryKeys.length > 0 ||
    foreignKeys.length > 0 ||
    uniqueConstraints.length > 0 ||
    checkConstraints.length > 0 ||
    triggers.length > 0 ||
    indexes.length > 0;

  if (!hasAnyInfo) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 border-l pl-3">
      {/* Primary Keys */}
      <InfoBadge
        icon={<Key className="h-3.5 w-3.5" />}
        count={primaryKeys.length}
        label="Primary Key"
        colorClass="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:hover:bg-yellow-950"
        items={primaryKeys.map((c) => ({
          name: c.name,
          detail: `(${c.columns.join(', ')})`,
        }))}
      />

      {/* Foreign Keys */}
      <InfoBadge
        icon={<Link2 className="h-3.5 w-3.5" />}
        count={foreignKeys.length}
        label="Foreign Key"
        colorClass="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
        items={foreignKeys.map((c) => ({
          name: c.name,
          detail: c.definition.match(/REFERENCES\s+([^\s(]+)/)?.[1],
        }))}
      />

      {/* Unique Constraints */}
      <InfoBadge
        icon={<Hash className="h-3.5 w-3.5" />}
        count={uniqueConstraints.length}
        label="Unique Constraint"
        colorClass="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950"
        items={uniqueConstraints.map((c) => ({
          name: c.name,
          detail: `(${c.columns.join(', ')})`,
        }))}
      />

      {/* Check Constraints */}
      <InfoBadge
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
        count={checkConstraints.length}
        label="Check Constraint"
        colorClass="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
        items={checkConstraints.map((c) => ({
          name: c.name,
          detail: c.definition.replace(/^CHECK\s*/i, '').slice(0, 30),
        }))}
      />

      {/* Triggers */}
      <InfoBadge
        icon={<Zap className="h-3.5 w-3.5" />}
        count={triggers.length}
        label="Trigger"
        colorClass="text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
        items={triggers.map((t) => ({
          name: t.name,
          detail: `${t.timing} ${t.events.join('/')}`,
        }))}
      />

      {/* View Full Info Button */}
      {onViewFullInfo && (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                onClick={onViewFullInfo}
              >
                <Info className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>View full table info</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
