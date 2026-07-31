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
}

const SettingsCardHeader = React.forwardRef<
  HTMLDivElement,
  SettingsCardHeaderProps
>(
  (
    { className, title, description, icon, actions, control, ...props },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        'grid grid-flow-col place-content-between gap-3 px-4',
        className,
      )}
      {...props}
    >
      <div className="grid grid-flow-col gap-4">
        {typeof icon === 'string' ? (
          <div className="flex items-center self-center justify-self-center align-middle">
            <Image src={icon} alt="" width={32} height={32} />
          </div>
        ) : (
          icon
        )}

        <div className="grid grid-flow-row gap-1">
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
        <div className="flex items-center gap-3 self-center">
          {actions}
          {control}
        </div>
      )}
    </div>
  ),
);
SettingsCardHeader.displayName = 'SettingsCardHeader';

export { SettingsCardHeader };
