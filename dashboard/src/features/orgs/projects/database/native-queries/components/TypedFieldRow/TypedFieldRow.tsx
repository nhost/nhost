import { X } from 'lucide-react';
import { type ComponentProps, type ReactNode, useId } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Input, type InputProps } from '@/components/ui/v3/input';
import { TypedFieldDescription } from '@/features/orgs/projects/database/native-queries/components/TypedFieldDescription';
import { TYPED_FIELDS_GRID_CLASS_NAMES } from '@/features/orgs/projects/database/native-queries/components/TypedFieldsSection';
import { cn } from '@/lib/utils';

export type TypedFieldNoun = 'Field' | 'Argument';

interface TypedFieldRowProps {
  noun: TypedFieldNoun;
  index: number;
  nameInputProps: InputProps;
  descriptionInputProps: ComponentProps<'textarea'>;
  descriptionValue?: string;
  nameError?: string;
  typeEditor: ReactNode;
  continuationRows?: ReactNode;
  onRemove: VoidFunction;
}

export default function TypedFieldRow({
  noun,
  index,
  nameInputProps,
  descriptionInputProps,
  descriptionValue,
  nameError,
  typeEditor,
  continuationRows,
  onRemove,
}: TypedFieldRowProps) {
  const errorId = useId();
  const position = index + 1;
  const lowercaseNoun = noun.toLowerCase();
  const removeLabel = `Remove ${lowercaseNoun} ${position}`;
  const variant = noun === 'Field' ? 'field' : 'argument';

  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="sr-only">
        {noun} {position}
      </legend>
      <div
        className={cn(
          'grid items-start gap-2 py-2',
          TYPED_FIELDS_GRID_CLASS_NAMES[variant],
        )}
      >
        <div className="min-w-0 space-y-1">
          <Input
            {...nameInputProps}
            aria-label={`${noun} ${position} name`}
            aria-invalid={Boolean(nameError)}
            aria-describedby={nameError ? errorId : undefined}
            placeholder={nameInputProps.placeholder ?? `${noun} name`}
          />
          {nameError && (
            <p id={errorId} className="text-destructive text-sm">
              {nameError}
            </p>
          )}
        </div>

        {typeEditor}

        <div className="flex h-10 items-center justify-center">
          <TypedFieldDescription
            noun={noun}
            index={index}
            value={descriptionValue}
            inputProps={descriptionInputProps}
          />
        </div>

        <div className="flex h-10 items-center justify-center">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            aria-label={removeLabel}
            onClick={onRemove}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {continuationRows}
    </fieldset>
  );
}
