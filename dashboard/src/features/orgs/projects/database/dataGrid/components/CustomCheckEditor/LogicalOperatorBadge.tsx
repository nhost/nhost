import { ChevronDown } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/v3/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import type { LogicalOperator } from '@/features/orgs/projects/database/dataGrid/utils/permissionUtils';
import { cn } from '@/lib/utils';

const operatorOptions: {
  value: LogicalOperator;
  label: string;
  description?: string;
}[] = [
  {
    value: '_implicit',
    label: 'Implicit',
    description: 'treated as AND',
  },
  { value: '_and', label: 'AND' },
  { value: '_or', label: 'OR' },
  { value: '_not', label: 'NOT' },
];

const parentBackgrounds = [
  'bg-background',
  'bg-secondary-100',
  'bg-secondary-200',
  'bg-secondary-300',
  'bg-secondary-400',
  'bg-secondary-500',
  'bg-secondary-600',
  'bg-secondary-700',
] as const;

interface LogicalOperatorBadgeProps {
  name: string;
  disabled?: boolean;
  depth?: number;
}

export default function LogicalOperatorBadge({
  name,
  disabled,
  depth = 0,
}: LogicalOperatorBadgeProps) {
  const { setValue } = useFormContext();
  const operator: LogicalOperator = useWatch({ name: `${name}.operator` });

  const currentLabel =
    operatorOptions.find((o) => o.value === operator)?.label ?? 'AND';

  const badgeBg =
    parentBackgrounds[Math.min(depth, parentBackgrounds.length - 1)];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Badge
          variant="outline"
          className={cn(
            'cursor-pointer gap-1 rounded-md px-2 py-0.5 hover:bg-accent',
            badgeBg,
          )}
        >
          {currentLabel}
          <ChevronDown className="h-3 w-3" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={operator}
          onValueChange={(value) => {
            setValue(`${name}.operator`, value, { shouldDirty: true });
          }}
        >
          {operatorOptions.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value}>
              <span>{option.label}</span>
              {option.description && (
                <span className="ml-2 text-muted-foreground text-xs">
                  {option.description}
                </span>
              )}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
