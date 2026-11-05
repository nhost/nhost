import { Check } from 'lucide-react';
import {
  type ComponentPropsWithoutRef,
  type ForwardedRef,
  forwardRef,
  type ReactNode,
} from 'react';
import { Badge } from '@/components/ui/v3/badge';
import { FormControl, FormLabel } from '@/components/ui/v3/form';
import { RadioGroupItem } from '@/components/ui/v3/radio-group';
import { cn } from '@/lib/utils';

export interface PlanCardProps
  extends Omit<ComponentPropsWithoutRef<'label'>, 'children'> {
  /**
   * Radio value of this plan. Leave it out for a card that only links
   * somewhere (for example Enterprise, which is contact only).
   */
  value?: string;
  name: string;
  /** Main price text, for example `Free`, `$25` or `Custom`. */
  price?: string;
  /** Adds `/month` after the price. */
  isMonthly?: boolean;
  description?: string;
  /** Feature list under a divider. Not shown on compact cards. */
  highlights?: string[];
  isSelected?: boolean;
  isCurrent?: boolean;
  isPopular?: boolean;
  disabled?: boolean;
  /**
   * One row per plan with less information, for narrow dialogs: details on
   * the left, price (or `children`) on the right.
   */
  compact?: boolean;
  children?: ReactNode;
}

function PlanHighlightList({
  highlights,
  isSelected,
}: {
  highlights: string[];
  isSelected: boolean;
}) {
  return (
    <ul className="mt-4 space-y-2.5 border-t pt-4">
      {highlights.map((highlight) => (
        <li
          key={highlight}
          className="flex items-start gap-2.5 font-normal text-sm leading-snug"
        >
          <span
            className={cn(
              'mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full',
              isSelected
                ? 'bg-primary text-on-solid'
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
          </span>
          <span>{highlight}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Selectable plan card used by the upgrade and new organization dialogs.
 * Selection is shown by the card border; the radio input stays in the
 * markup for keyboard and screen reader users but is visually hidden.
 * Must be rendered inside a `RadioGroup` and a `FormItem` when `value` is set.
 */
const PlanCard = forwardRef(
  (
    {
      value,
      name,
      price,
      isMonthly,
      description,
      highlights = [],
      isSelected = false,
      isCurrent = false,
      isPopular = false,
      disabled = false,
      compact = false,
      className,
      children,
      ...props
    }: PlanCardProps,
    ref: ForwardedRef<HTMLLabelElement>,
  ) => {
    const isSelectable = value !== undefined;

    const cardClassName = cn(
      'relative flex border font-normal leading-normal transition-all duration-200',
      compact
        ? 'w-full flex-row items-center justify-between gap-4 rounded-lg p-3'
        : 'h-full flex-col rounded-xl p-4',
      isSelectable && 'cursor-pointer',
      isSelectable &&
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background',
      isCurrent && 'cursor-not-allowed bg-muted/30',
      !isCurrent &&
        isSelected &&
        'border-primary bg-primary/[0.03] ring-1 ring-primary',
      !isCurrent && !isSelected && disabled && 'cursor-not-allowed',
      !isCurrent &&
        !isSelected &&
        !disabled &&
        'hover:border-primary hover:bg-muted/20',
      // Compact cards sit inside a tinted container, so they keep a solid
      // background in every state to stand out from it.
      compact && 'bg-background hover:bg-background',
      className,
    );

    const radio = isSelectable && (
      <FormControl>
        <RadioGroupItem value={value} disabled={disabled} className="sr-only" />
      </FormControl>
    );

    const currentBadge = isCurrent && (
      <Badge variant="secondary" className="uppercase tracking-wide">
        Current
      </Badge>
    );

    const priceBlock = price && (
      <div
        className={cn(
          'flex shrink-0',
          compact ? 'flex-col items-end' : 'items-baseline gap-1',
        )}
      >
        <span
          className={cn(
            'font-semibold tracking-tight',
            compact ? 'text-xl' : 'text-3xl',
          )}
        >
          {price}
        </span>
        {isMonthly && (
          <span
            className={cn(
              'text-muted-foreground',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            /month
          </span>
        )}
      </div>
    );

    // Compact: one row per plan, details on the left and price on the right.
    const compactContent = (
      <>
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-sm">{name}</span>
            {isPopular && (
              <Badge className="px-2 py-0 text-[10px] uppercase tracking-wide">
                Most popular
              </Badge>
            )}
            {currentBadge}
            {radio}
          </div>
          {description && (
            <p className="text-muted-foreground text-xs leading-snug">
              {description}
            </p>
          )}
        </div>
        {priceBlock}
        {children}
      </>
    );

    const content = (
      <>
        {isPopular && (
          <Badge className="absolute -top-2.5 left-4 uppercase tracking-wide">
            Most popular
          </Badge>
        )}

        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="font-semibold text-base">{name}</span>
          {currentBadge}
          {radio}
        </div>

        {priceBlock && <div className="mt-3">{priceBlock}</div>}

        {description && (
          <p className="mt-2 text-muted-foreground text-sm leading-snug">
            {description}
          </p>
        )}

        {highlights.length > 0 && (
          <PlanHighlightList highlights={highlights} isSelected={isSelected} />
        )}

        {children}
      </>
    );

    if (!isSelectable) {
      return (
        <div className={cardClassName}>
          {compact ? compactContent : content}
        </div>
      );
    }

    return (
      <FormLabel ref={ref} className={cardClassName} {...props}>
        {compact ? compactContent : content}
      </FormLabel>
    );
  },
);

PlanCard.displayName = 'PlanCard';

export default PlanCard;
