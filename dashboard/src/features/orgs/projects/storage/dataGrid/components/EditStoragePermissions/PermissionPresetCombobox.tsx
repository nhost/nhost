import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';

import type { PermissionPreset } from './types';
import usePermissionPresets from './usePermissionPresets';

interface PermissionPresetComboboxProps {
  onSelect: (preset: PermissionPreset) => void;
  disabled?: boolean;
}

export default function PermissionPresetCombobox({
  onSelect,
  disabled,
}: PermissionPresetComboboxProps) {
  const { presetGroups } = usePermissionPresets();
  const hasBuckets = presetGroups.some((g) => g.presets.length > 0);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          disabled={disabled || !hasBuckets}
          variant="outline"
          size="sm"
          className="w-fit"
        >
          Permission presets
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {presetGroups.map((group) => (
          <DropdownMenuSub key={group.label}>
            <DropdownMenuSubTrigger>{group.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {group.presets.map((preset) => (
                <DropdownMenuItem
                  key={preset.id}
                  onSelect={() => onSelect(preset)}
                >
                  {preset.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
