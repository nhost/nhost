import type { GraphQLArgument } from 'graphql';
import { Braces } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/v3/input-group';
import type {
  ArgLeafType,
  ArgTreeType,
} from '@/features/orgs/projects/remote-schemas/types';
import formatPresetForInput from '@/features/orgs/projects/remote-schemas/utils/formatPresetForInput';
import PresetLiteralMenuItems from './PresetLiteralMenuItems';

interface PresetValueInputProps {
  arg: GraphQLArgument;
  rawValue: ArgLeafType | ArgTreeType | undefined;
  sessionVariableOptions: string[];
  onValueChange: (value: ArgLeafType | undefined) => void;
}

export default function PresetValueInput({
  arg,
  rawValue,
  sessionVariableOptions,
  onValueChange,
}: PresetValueInputProps) {
  const presetValue = formatPresetForInput(rawValue);

  let placeholder = 'preset value';
  if (rawValue === null) {
    placeholder = '(null literal)';
  } else if (rawValue === '') {
    placeholder = '("" empty string)';
  }

  const isPresetSet = rawValue !== undefined;

  return (
    <div className="flex flex-1 items-center space-x-2">
      <span className="min-w-0 flex-shrink-0 text-gray-600 text-sm">
        {arg.name}: {arg.type.toString()}
      </span>
      <InputGroup className="max-w-xs flex-1">
        <InputGroupInput
          placeholder={placeholder}
          value={presetValue}
          onChange={(e) =>
            onValueChange(
              e.target.value.trim() === '' ? undefined : e.target.value,
            )
          }
          className="text-xs"
          wrapperClassName="w-full"
        />
        <InputGroupAddon align="inline-end" tabIndex={-1}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <InputGroupButton
                variant="outline"
                size="icon-xs"
                aria-label="Insert preset expression"
                className="h-6 w-6 text-muted-foreground"
              >
                <Braces className="size-3.5" />
              </InputGroupButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[14rem]">
              <PresetLiteralMenuItems
                arg={arg}
                sessionVariableOptions={sessionVariableOptions}
                isPresetSet={isPresetSet}
                onValueChange={onValueChange}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
