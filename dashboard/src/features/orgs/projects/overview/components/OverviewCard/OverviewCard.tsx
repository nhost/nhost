import { ArrowRightIcon } from 'lucide-react';
import type {
  ComponentPropsWithoutRef,
  HTMLAttributes,
  ReactElement,
} from 'react';
import type { CardProps } from '@/features/orgs/projects/overview/types/cards';
import { cn } from '@/lib/utils';

export interface OverviewCardProps extends CardProps {
  /**
   * Props to be passed to the internal components.
   */
  slotProps?: {
    iconWrapper?: HTMLAttributes<HTMLDivElement>;
    imgIcon?: Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'>;
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
  imageProps: Omit<ComponentPropsWithoutRef<'img'>, 'src' | 'alt'>;
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
        <img
          src={icon}
          alt={title}
          width={width}
          height={height}
          className={cn('dark:hidden', className)}
          {...props}
        />
        <img
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
    <img
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

  return (
    <div
      className={cn(
        'flex h-full flex-col place-content-between gap-12 rounded-lg border bg-muted px-4 py-3 shadow-sm',
        className,
      )}
      {...props}
    >
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
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="grid grid-flow-col items-center justify-start gap-1 font-medium text-primary text-sm hover:underline"
        >
          Learn more
          <span className="sr-only"> about {title}</span>
          <ArrowRightIcon className="h-4 w-4" />
        </a>
      )}
    </div>
  );
}
