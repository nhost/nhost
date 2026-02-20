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
import type { LogicalOperator } from '@/features/orgs/projects/database/dataGrid/utils/ruleGroupV2';
import { cn } from '@/lib/utils';

const operatorOptions: { value: LogicalOperator; label: string }[] = [
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

interface OperatorBadgeProps {
  name: string;
  disabled?: boolean;
  depth?: number;
}

export default function OperatorBadge({
  name,
  disabled,
  depth = 0,
}: OperatorBadgeProps) {
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
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
