import type { ImageProps } from 'next/image';
import Image from 'next/image';
import Link from 'next/link';
import type { AnchorHTMLAttributes, HTMLAttributes, ReactElement } from 'react';
import type { CardProps } from '@/features/orgs/projects/overview/types/cards';
import { cn } from '@/lib/utils';

export interface OverviewCardProps extends CardProps {
  /**
   * Props to be passed to the internal components.
   */
  slotProps?: {
    iconWrapper?: HTMLAttributes<HTMLDivElement>;
    imgIcon?: Omit<Partial<ImageProps>, 'src' | 'alt'>;
  };
}

function renderIcon({
  icon,
  lightIcon,
  title,
  iconIsComponent,
  imageProps,
}: {
  icon: string | ReactElement;
  lightIcon?: string | ReactElement;
  title: string;
  iconIsComponent: boolean;
  imageProps: Omit<Partial<ImageProps>, 'src' | 'alt'>;
}) {
  if (iconIsComponent) {
    return icon;
  }

  if (typeof icon !== 'string') {
    return null;
  }

  const { className, width = 32, height = 32, ...props } = imageProps;

  if (typeof lightIcon === 'string') {
    return (
      <>
        <Image
          src={icon}
          alt={title}
          width={width}
          height={height}
          className={cn('dark:hidden', className)}
          {...props}
        />
        <Image
          src={lightIcon}
          alt={title}
          width={width}
          height={height}
          className={cn('hidden dark:block', className)}
          {...props}
        />
      </>
    );
  }

  return (
    <Image
      src={icon}
      alt={title}
      width={width}
      height={height}
      className={className}
      {...props}
    />
  );
}

export default function OverviewCard({
  title,
  description,
  icon,
  lightIcon,
  link,
  iconIsComponent = true,
  disableIconBackground = false,
  className,
  slotProps = {},
  ...props
}: OverviewCardProps) {
  const imageSize = disableIconBackground ? 42 : 32;

  // The whole card is the click target (it links out to the docs page),
  // so the hover state lives on the card's own border instead of on a
  // separate "Learn more" link. When there's no link to send people to,
  // it falls back to a plain, non-interactive div with no hover effect.
  const cardClassName = cn(
    'flex h-full flex-col place-content-between gap-6 rounded-lg border p-6 shadow-sm transition-colors',
    link && 'hover:border-primary',
    className,
  );

  const content = (
    <div className="flex flex-col gap-4">
      <div
        {...(slotProps.iconWrapper || {})}
        className={cn(
          disableIconBackground
            ? 'inline-flex h-12 w-12 items-center'
            : 'inline-flex h-12 w-12 items-center justify-center rounded-full border bg-background shadow-xl',
          slotProps.iconWrapper?.className,
        )}
      >
        {renderIcon({
          icon,
          lightIcon,
          title,
          iconIsComponent,
          imageProps: {
            width: imageSize,
            height: imageSize,
            ...slotProps.imgIcon,
          },
        })}
      </div>
      <div className="grid grid-flow-row gap-1">
        <h3 className="font-bold text-lg">{title}</h3>
        <p className="font-medium text-muted-foreground text-sm">
          {description}
        </p>
      </div>
    </div>
  );

  if (link) {
    return (
      <Link
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClassName}
        // `props` is typed as HTMLAttributes<HTMLDivElement> (from CardProps,
        // shared with the plain-div fallback below) but none of the actual
        // card data passes div-specific event handlers, so this is a safe
        // narrowing to satisfy Link's anchor-typed props.
        {...(props as AnchorHTMLAttributes<HTMLAnchorElement>)}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={cardClassName} {...props}>
      {content}
    </div>
  );
}
