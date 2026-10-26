import * as RadioGroupPrimitive from '@radix-ui/react-radio-group';
import { Circle } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const RadioGroup = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn('grid gap-2', className)}
      {...props}
      ref={ref}
    />
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        'aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export interface RadioCardProps
  extends Omit<
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>,
    'title'
  > {
  title: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Shown at the bottom of the card, e.g. a "Learn more" docs link. It sits
   * above the clickable area, so a link here works without selecting the
   * card.
   */
  footer?: React.ReactNode;
}

// A radio option shown as a card. The selected card is marked by the primary
// border and a light tint instead of a radio circle. The real radio is a
// transparent button covering the whole card, so keyboard (arrow keys within
// the group) and screen readers work like a normal RadioGroup, and the footer
// can hold a link without nesting it inside a button.
const RadioCard = React.forwardRef<
  React.ComponentRef<typeof RadioGroupPrimitive.Item>,
  RadioCardProps
>(({ className, title, description, footer, ...props }, ref) => {
  const id = React.useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <div
      className={cn(
        'relative flex flex-col gap-1.5 rounded-lg border p-4 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 has-[:disabled]:opacity-50',
        className,
      )}
    >
      <RadioGroupPrimitive.Item
        ref={ref}
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className="absolute inset-0 cursor-pointer rounded-lg ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed"
        {...props}
      />
      <span id={titleId} className="font-medium text-sm">
        {title}
      </span>
      {description && (
        <p id={descriptionId} className="text-muted-foreground text-sm">
          {description}
        </p>
      )}
      {footer && <div className="relative mt-auto pt-1 text-sm">{footer}</div>}
    </div>
  );
});
RadioCard.displayName = 'RadioCard';

export { RadioCard, RadioGroup, RadioGroupItem };
