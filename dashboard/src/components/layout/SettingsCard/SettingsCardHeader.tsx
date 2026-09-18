import Image from 'next/image';
import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SettingsCardHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /**
   * The title of the section.
   */
  title: React.ReactNode;
  /**
   * The description shown under the title.
   */
  description?: React.ReactNode;
  /**
   * Icon for the section. A string is treated as an image `src`.
   */
  icon?: React.ReactNode | string;
  /**
   * Element rendered at the top-right corner, before `control`. Use for
   * badges, menus, or auxiliary actions.
   */
  actions?: React.ReactNode;
  /**
   * Control rendered at the far top-right corner. Use for a feature toggle
   * owned by the surrounding form (e.g. an RHF `FormSwitch`).
   */
  control?: React.ReactNode;
  /**
   * Additional classes for the left side (icon + title + description)
   * wrapper. By default that side is `flex-1` and grows to fill all the
   * room left by `actions`/`control`, so a long description wraps right up
   * against them. Pass a max-width here (e.g. `sm:max-w-lg`) to cap it and
   * guarantee real whitespace before the action, regardless of how the
   * text wraps.
   */
  contentClassName?: string;
}

const SettingsCardHeader = React.forwardRef<
  HTMLDivElement,
  SettingsCardHeaderProps
>(
  (
    {
      className,
      title,
      description,
      icon,
      actions,
      control,
      contentClassName,
      ...props
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        'flex flex-col gap-3 px-6 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
      {...props}
    >
      <div className={cn('flex min-w-0 flex-1 gap-4', contentClassName)}>
        {typeof icon === 'string' ? (
          <div className="flex shrink-0 items-center self-center justify-self-center align-middle">
            <Image src={icon} alt="" width={32} height={32} />
          </div>
        ) : (
          icon
        )}

        <div className="grid min-w-0 grid-flow-row gap-1">
          {typeof title === 'string' ? (
            <h3 className="font-semibold text-lg">{title}</h3>
          ) : (
            title
          )}

          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
      </div>

      {(actions || control) && (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {actions}
          {control}
        </div>
      )}
    </div>
  ),
);
SettingsCardHeader.displayName = 'SettingsCardHeader';

export { SettingsCardHeader };
