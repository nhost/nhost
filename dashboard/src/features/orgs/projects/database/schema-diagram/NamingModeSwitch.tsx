import { Switch } from '@/components/ui/v3/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import type { NamingMode } from './useSchemaGraph';

export interface NamingModeSwitchProps {
  namingMode: NamingMode;
  onNamingModeChange: (mode: NamingMode) => void;
}

export default function NamingModeSwitch({
  namingMode,
  onNamingModeChange,
}: NamingModeSwitchProps) {
  const isGraphqlMode = namingMode === 'graphql';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2">
          <Switch
            id="schema-diagram-naming-mode"
            checked={isGraphqlMode}
            onCheckedChange={(checked) =>
              onNamingModeChange(checked ? 'graphql' : 'postgres')
            }
          />
          <label
            htmlFor="schema-diagram-naming-mode"
            className="cursor-pointer text-xs"
          >
            GraphQL view
          </label>
        </div>
      </TooltipTrigger>
      <TooltipContent className="max-w-[280px]">
        Show GraphQL custom names (highlighted in purple) and computed fields.
        Disable to see only the postgres-native schema.
      </TooltipContent>
    </Tooltip>
  );
}
