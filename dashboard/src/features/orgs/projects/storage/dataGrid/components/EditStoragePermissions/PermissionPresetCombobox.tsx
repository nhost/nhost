import { ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
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
  const { presets } = usePermissionPresets();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          disabled={disabled || presets.length === 0}
          variant="outline"
          size="sm"
          className="w-fit"
        >
          Apply preset
          <ChevronDown className="h-4 w-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Buckets</DropdownMenuLabel>
        {presets.map((preset) => (
          <DropdownMenuItem key={preset.id} onSelect={() => onSelect(preset)}>
            {preset.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
