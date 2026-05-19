import {
  type GraphQLArgument,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFloat,
  GraphQLInputObjectType,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
} from 'graphql';
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/components/ui/v3/dropdown-menu';
import type { ArgLeafType } from '@/features/orgs/projects/remote-schemas/types';
import unwrapNamedType from '@/features/orgs/projects/remote-schemas/utils/unwrapNamedType';

interface PresetLiteralMenuItemsProps {
  arg: GraphQLArgument;
  sessionVariableOptions: string[];
  isPresetSet: boolean;
  onValueChange: (value: ArgLeafType | undefined) => void;
}

export default function PresetLiteralMenuItems({
  arg,
  sessionVariableOptions,
  isPresetSet,
  onValueChange,
}: PresetLiteralMenuItemsProps) {
  const baseType = unwrapNamedType(arg.type);
  const outer = arg.type instanceof GraphQLNonNull ? arg.type.ofType : arg.type;
  const isList = outer instanceof GraphQLList;
  const isEnum = baseType instanceof GraphQLEnumType;
  const isBoolean = baseType === GraphQLBoolean;
  const isNumeric = baseType === GraphQLInt || baseType === GraphQLFloat;
  const isInputObject = baseType instanceof GraphQLInputObjectType;

  const enumValues = !isList && isEnum ? baseType.getValues() : null;
  const acceptsBoolean = !isList && isBoolean;
  const acceptsNull = !(arg.type instanceof GraphQLNonNull);
  const acceptsEmptyString =
    !isList && !isBoolean && !isNumeric && !isEnum && !isInputObject;
  const acceptsSessionVariable =
    !isList && (baseType instanceof GraphQLScalarType || isEnum);

  return (
    <>
      <DropdownMenuLabel>Insert literal</DropdownMenuLabel>
      {acceptsNull && (
        <DropdownMenuItem onSelect={() => onValueChange(null)}>
          <span className="font-mono">null</span>
        </DropdownMenuItem>
      )}
      {acceptsEmptyString && (
        <DropdownMenuItem onSelect={() => onValueChange('')}>
          <span className="font-mono">&quot;&quot;</span>
          <span className="ml-2 text-muted-foreground text-xs">
            empty string
          </span>
        </DropdownMenuItem>
      )}
      {acceptsBoolean && (
        <>
          <DropdownMenuItem onSelect={() => onValueChange(true)}>
            <span className="font-mono">true</span>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onValueChange(false)}>
            <span className="font-mono">false</span>
          </DropdownMenuItem>
        </>
      )}
      {enumValues && enumValues.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Enum values</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              {enumValues.map((v) => (
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
      {acceptsSessionVariable && sessionVariableOptions.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              Permission variables
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
              {sessionVariableOptions.map((v) => (
                <DropdownMenuItem key={v} onSelect={() => onValueChange(v)}>
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
    </>
  );
}
