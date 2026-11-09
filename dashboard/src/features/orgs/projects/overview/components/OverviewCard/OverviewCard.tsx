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
  const imageSize = disableIconBackground ? 36 : 24;

  // The whole card is the click target (it links out to the docs page), so
  // the hover state lives on the card's own border instead of on a separate
  // "Learn more" link. Without a link it stays a plain, non-interactive div.
  const cardClassName = cn(
    'flex h-full flex-col gap-3 rounded-lg border p-4 shadow-sm transition-colors',
    link && 'hover:border-primary',
    className,
  );

  const content = (
    <>
      <div
        {...(slotProps.iconWrapper || {})}
        className={cn(
          disableIconBackground
            ? 'inline-flex h-10 items-center'
            : 'inline-flex h-10 w-10 items-center justify-center rounded-full border bg-background shadow-md',
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
      <div className="flex flex-col gap-1">
        <h3 className="font-semibold text-sm">{title}</h3>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </>
  );

  if (link) {
    return (
      <Link
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className={cardClassName}
        // `props` is typed for the plain-div fallback below; none of the card
        // data passes div-specific handlers, so this narrowing is safe.
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
