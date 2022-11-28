import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ContainerProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  /**
   * Class name passed to the root element.
   */
  rootClassName?: string;
}

export default function Container({
  children,
  className,
  rootClassName,
  ...props
}: ContainerProps) {
  return (
    <div className={twMerge('mx-auto w-full bg-white', rootClassName)}>
      <div
        className={twMerge(
          'mx-auto max-w-7xl bg-white px-5 pt-6 pb-20',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}
