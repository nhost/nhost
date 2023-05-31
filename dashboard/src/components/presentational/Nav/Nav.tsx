import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface NavProps
  extends DetailedHTMLProps<HTMLProps<HTMLElement>, HTMLElement> {
  /**
   * Props to be passed to the underlying `<ul>` element.
   */
  listProps?: DetailedHTMLProps<HTMLProps<HTMLUListElement>, HTMLUListElement>;
  /**
   * Flow of navigation items.
   *
   * @default 'column'
   */
  flow?: 'column' | 'row';
}

export default function Nav({
  children,
  className,
  listProps: { className: listClassName, ...listProps } = {},
  flow = 'column',
  ...props
}: NavProps) {
  return (
    <nav
      className={twMerge(
        'grid grid-flow-col items-center gap-2 self-center',
        className,
      )}
      {...props}
    >
      <ul
        className={twMerge(
          'grid list-none items-center gap-3',
          flow === 'column' ? 'grid-flow-col justify-start' : 'grid-flow-row',
          listClassName,
        )}
        {...listProps}
      >
        {children}
      </ul>
    </nav>
  );
}
