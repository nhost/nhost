import type { GraphQLArgument } from 'graphql';
import { Braces } from 'lucide-react';
import { useMemo } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import getArgPresetCapabilities from '@/features/orgs/projects/remote-schemas/utils/getArgPresetCapabilities';

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
  const cap = useMemo(() => getArgPresetCapabilities(arg), [arg]);
  const presetValue = formatPresetForInput(rawValue);

  let placeholder = 'preset value';
  if (rawValue === null) {
    placeholder = '(null literal)';
  } else if (rawValue === '') {
    placeholder = '(empty string "")';
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
              <DropdownMenuLabel>Insert literal</DropdownMenuLabel>
              {cap.acceptsNull && (
                <DropdownMenuItem onSelect={() => onValueChange(null)}>
                  <span className="font-mono">null</span>
                </DropdownMenuItem>
              )}
              {cap.acceptsEmptyString && (
                <DropdownMenuItem onSelect={() => onValueChange('')}>
                  <span className="font-mono">&quot;&quot;</span>
                  <span className="ml-2 text-muted-foreground text-xs">
                    empty string
                  </span>
                </DropdownMenuItem>
              )}
              {cap.acceptsBoolean && (
                <>
                  <DropdownMenuItem onSelect={() => onValueChange(true)}>
                    <span className="font-mono">true</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => onValueChange(false)}>
                    <span className="font-mono">false</span>
                  </DropdownMenuItem>
                </>
              )}
              {cap.enumValues && cap.enumValues.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Enum values</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                      {cap.enumValues.map((v) => (
                        <DropdownMenuItem
                          key={v.name}
                          onSelect={() => onValueChange(v.name)}
                        >
                          <span className="font-mono">{v.name}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                </>
              )}
              {cap.acceptsSessionVariable &&
                sessionVariableOptions.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        Permission variables
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                        {sessionVariableOptions.map((v) => (
                          <DropdownMenuItem
                            key={v}
                            onSelect={() => onValueChange(v)}
                          >
                            <span className="font-mono">{v}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  </>
                )}
              {isPresetSet && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() => onValueChange(undefined)}
                    className="text-destructive focus:text-destructive"
                  >
                    Clear preset
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </InputGroupAddon>
      </InputGroup>
    </div>
  );
}
