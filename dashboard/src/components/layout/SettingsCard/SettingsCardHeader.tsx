import Image from 'next/image';
import * as React from 'react';
import {
  SettingsDocsLink,
  type SettingsDocsLinkProps,
} from '@/components/layout/SettingsCard/SettingsDocsLink';
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
   * `lg` for a page with a few big sections (like project General), where
   * the card titles act as section headings.
   */
  size?: 'default' | 'lg';
  /**
   * Content under the title and description, in the same column, so a
   * `control` on the right stays centred against all of it (e.g. a single
   * field with its Save button).
   */
  children?: React.ReactNode;
  /**
   * Docs for this section, shown as a help icon right after the title.
   */
  docsLink?: SettingsDocsLinkProps;
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
      size = 'default',
      children,
      docsLink,
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
      {/* With a control or actions on the right, the description stops at a
          readable width instead of running into them. */}
      <div
        className={cn(
          'flex min-w-0 flex-1 gap-4',
          Boolean(control || actions) && 'sm:max-w-lg',
        )}
      >
        {typeof icon === 'string' ? (
          <div className="flex shrink-0 items-center self-center justify-self-center align-middle">
            <Image src={icon} alt="" width={32} height={32} />
          </div>
        ) : (
          icon
        )}

        <div className="grid min-w-0 grid-flow-row gap-0.5">
          <div className="flex items-center gap-1">
            {typeof title === 'string' ? (
              <h3
                className={cn(
                  'font-semibold',
                  size === 'lg' ? 'text-xl' : 'text-lg',
                )}
              >
                {title}
              </h3>
            ) : (
              title
            )}
            {docsLink && <SettingsDocsLink {...docsLink} />}
          </div>

          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}

          {children && <div className="mt-2">{children}</div>}
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
