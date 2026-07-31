import type { HTMLAttributes, ReactElement } from 'react';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Title for the framework.
   */
  title: string;
  /**
   * Description of the framework.
   */
  description: string;
  /**
   * Icon to display on the card.
   */
  icon: string | ReactElement;
  /**
   * Light version of the icon. This is used for the dark mode.
   */
  lightIcon?: string | ReactElement;
  /**
   * Determines whether the icon should have a background.
   * @default false
   */
  disableIconBackground?: boolean;
  /**
   * Determines whether the icon is a react component.
   * @default true
   */
  iconIsComponent?: boolean;
  /**
   * Link to the specific framework documentation.
   */
  link?: string;
}
