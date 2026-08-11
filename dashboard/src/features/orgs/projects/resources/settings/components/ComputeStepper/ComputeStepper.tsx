import { Minus, Plus } from 'lucide-react';
import { Controller, useFormContext } from 'react-hook-form';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

export interface ComputeStepperProps {
  name: string;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  ariaLabel: string;
  disabled?: boolean;
  className?: string;
  onValueChange?: (value: number) => void;
  minHint?: string;
  maxHint?: string;
}

export default function ComputeStepper({
  name,
  min,
  max,
  step,
  format,
  ariaLabel,
  disabled,
  className,
  onValueChange,
  minHint,
  maxHint,
}: ComputeStepperProps) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const numericValue = Number(field.value ?? min);
        const clampedValue = Number.isFinite(numericValue) ? numericValue : min;
        const atMin = clampedValue <= min;
        const atMax = clampedValue >= max;

        const updateValue = (next: number) => {
          const clamped = Math.min(Math.max(next, min), max);
          if (clamped === clampedValue) {
            return;
          }
          field.onChange(clamped);
          onValueChange?.(clamped);
        };

        return (
          <div
            className={cn(
              'inline-flex w-fit items-center gap-1 justify-self-start rounded-md border bg-background',
              disabled && 'opacity-50',
              className,
            )}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={disabled || atMin}
                    aria-label={`Decrease ${ariaLabel}`}
                    onClick={() => updateValue(clampedValue - step)}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              {atMin && minHint && <TooltipContent>{minHint}</TooltipContent>}
            </Tooltip>

            <span
              role="status"
              aria-label={ariaLabel}
              className="min-w-[5rem] select-none text-center font-medium text-sm tabular-nums"
              aria-live="polite"
            >
              {format(clampedValue)}
            </span>

            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    disabled={disabled || atMax}
                    aria-label={`Increase ${ariaLabel}`}
                    onClick={() => updateValue(clampedValue + step)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              {atMax && maxHint && <TooltipContent>{maxHint}</TooltipContent>}
            </Tooltip>
          </div>
        );
      }}
    />
  );
}
