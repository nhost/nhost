import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { memo } from 'react';
import { Text } from '@/components/ui/v2/Text';
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Checkbox } from '@/components/ui/v3/checkbox';
import type {
  ArgLeafType,
  ArgTreeType,
  CustomFieldType,
  FieldType,
} from '@/features/orgs/projects/remote-schemas/types';
import PresetValueInput from './PresetValueInput';

export interface RootFieldRowProps {
  schemaTypeName: string;
  field: FieldType | CustomFieldType;
  argTree: ArgTreeType;
  sessionVariableOptions: string[];
  onFieldToggle: (
    schemaTypeName: string,
    fieldName: string,
    checked: boolean,
  ) => void;
  onPresetCommit: (
    schemaTypeName: string,
    fieldName: string,
    argName: string,
    value: ArgLeafType | undefined,
  ) => void;
}

const RootFieldRow = memo(
  ({
    schemaTypeName,
    field,
    argTree,
    sessionVariableOptions,
    onFieldToggle,
    onPresetCommit,
  }: RootFieldRowProps) => {
    const fieldKey = `${schemaTypeName}.${field.name}`;
    const args = field.args ? Object.values(field.args) : [];
    const hasArgs = args.length > 0;

    if (hasArgs) {
      return (
        <AccordionItem value={fieldKey}>
          <AccordionTrigger className="justify-start py-2 text-left hover:no-underline">
            <div className="flex w-full items-center justify-start space-x-2 text-left">
              <CheckboxPrimitive.Root
                asChild
                id={fieldKey}
                aria-label={field.name}
                checked={field.checked}
                onCheckedChange={(checked) =>
                  onFieldToggle(schemaTypeName, field.name, checked as boolean)
                }
                className="peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              >
                <span className="peer h-4 w-4 shrink-0 rounded-sm border border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground">
                  <CheckboxPrimitive.Indicator className="flex items-center justify-center text-white">
                    <Check className="h-4 w-4" />
                  </CheckboxPrimitive.Indicator>
                </span>
              </CheckboxPrimitive.Root>
              <span className="font-medium">{field.name}</span>
              <span className="text-gray-500 text-sm">: {field.return}</span>
              <span className="text-gray-400 text-xs">
                ({args.length} arg{args.length > 1 ? 's' : ''})
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="ml-6 space-y-2 border-gray-200 border-l-2 pl-4">
              <Text className="font-medium text-gray-700 text-sm">
                Arguments:
              </Text>
              {args.map((arg) => (
                <PresetValueInput
                  key={arg.name}
                  arg={arg}
                  rawValue={argTree?.[schemaTypeName]?.[field.name]?.[arg.name]}
                  sessionVariableOptions={sessionVariableOptions}
                  onValueChange={(value) =>
                    onPresetCommit(schemaTypeName, field.name, arg.name, value)
                  }
                />
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      );
    }

    return (
      <div className="flex items-center space-x-2 border-b py-2">
        <Checkbox
          id={fieldKey}
          checked={field.checked}
          onCheckedChange={(checked) =>
            onFieldToggle(schemaTypeName, field.name, checked as boolean)
          }
        />
        <label htmlFor={fieldKey} className="flex-1 cursor-pointer">
          <span className="font-medium">{field.name}</span>
          <span className="ml-2 text-gray-500 text-sm">: {field.return}</span>
        </label>
      </div>
    );
  },
);

export default RootFieldRow;
