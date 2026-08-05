import { Trash2 } from 'lucide-react';
import { type ReactNode, useId } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Input, type InputProps } from '@/components/ui/v3/input';
import { cn } from '@/lib/utils';

export type TypedFieldNoun = 'Field' | 'Argument';

interface TypedFieldRowProps {
  noun: TypedFieldNoun;
  index: number;
  nameInputProps: InputProps;
  descriptionInputProps: InputProps;
  nameError?: string;
  typeEditor: ReactNode;
  onRemove: VoidFunction;
}

export default function TypedFieldRow({
  noun,
  index,
  nameInputProps,
  descriptionInputProps,
  nameError,
  typeEditor,
  onRemove,
}: TypedFieldRowProps) {
  const errorId = useId();
  const position = index + 1;
  const lowercaseNoun = noun.toLowerCase();

  return (
    <fieldset className="min-w-0 space-y-2 rounded-md bg-muted p-3">
      <legend className="sr-only">
        {noun} {position}
      </legend>
      <div className="flex gap-2">
        <Input
          {...nameInputProps}
          aria-label={`${noun} ${position} name`}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? errorId : undefined}
          placeholder={nameInputProps.placeholder ?? `${noun} name`}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Remove ${lowercaseNoun} ${position}`}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      {nameError && (
        <p id={errorId} className="text-destructive text-sm">
          {nameError}
        </p>
      )}
      <Input
        {...descriptionInputProps}
        className={cn('max-w-[33.5rem]', descriptionInputProps.className)}
        aria-label={`${noun} ${position} description`}
        placeholder={
          descriptionInputProps.placeholder ?? 'Description (optional)'
        }
      />
      {typeEditor}
    </fieldset>
  );
}
