import { useFormContext, useWatch } from 'react-hook-form';
import { FormField } from '@/components/ui/v3/form';
import {
  type InputSuggestion,
  InputWithSuggestions,
} from '@/components/ui/v3/input-with-suggestions';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { getPostgresFunctionsKey } from '@/features/orgs/projects/database/dataGrid/utils/getPostgresFunctionsKey';
import { postgresFunctions } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import type { FieldArrayInputProps } from './ColumnEditorRow';

const TOOLTIP_DELAY = 500;

export default function DefaultValueInput({ index }: FieldArrayInputProps) {
  const { control } = useFormContext();
  const type: string | null = useWatch({ name: `columns.${index}.type` });
  const isNullable = useWatch({ name: `columns.${index}.isNullable` });
  const identityColumnIndex = useWatch({ name: 'identityColumnIndex' });
  const isIdentity = identityColumnIndex === index;
  const isGenerated = useWatch({ name: `columns.${index}.isGenerated` });
  const generationExpression = useWatch({
    name: `columns.${index}.generationExpression`,
  });

  const functionKey = getPostgresFunctionsKey(type ?? undefined);
  const suggestions: InputSuggestion[] = (
    postgresFunctions[functionKey as keyof typeof postgresFunctions] ?? []
  ).map((functionName) => ({ label: functionName, value: functionName }));

  if (isGenerated) {
    return (
      <div
        className="flex h-10 w-full cursor-not-allowed items-center rounded-md border bg-background px-4 py-2 text-sm opacity-50"
        data-testid={`columns.${index}.generationExpression`}
      >
        <span className="truncate">{generationExpression || ''}</span>
      </div>
    );
  }

  return (
    <FormField
      control={control}
      name={`columns.${index}.defaultValue`}
      render={({ field }) => {
        const currentValue = typeof field.value === 'string' ? field.value : '';
        return (
          <Tooltip delayDuration={TOOLTIP_DELAY}>
            <TooltipTrigger asChild>
              <div className="w-full">
                <InputWithSuggestions
                  ref={field.ref}
                  name={field.name}
                  value={currentValue}
                  onChange={(next) => field.onChange(next.trim() ? next : null)}
                  onBlur={field.onBlur}
                  suggestions={suggestions}
                  filterSuggestions={false}
                  disabled={isIdentity}
                  placeholder={isNullable ? 'NULL' : 'NO DEFAULT VALUE'}
                  aria-label="Default Value"
                  className="!bg-transparent border-border"
                  data-testid={`columns.${index}.defaultValue`}
                />
              </div>
            </TooltipTrigger>
            {currentValue && (
              <TooltipContent side="top" className="max-w-80 break-all">
                {currentValue}
              </TooltipContent>
            )}
          </Tooltip>
        );
      }}
    />
  );
}
