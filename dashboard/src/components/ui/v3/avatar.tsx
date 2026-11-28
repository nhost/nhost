import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { hashString } from '@/utils/hashString';

// Hues stay clear of the theme's status colors (destructive, warning,
// success, primary) so an avatar never reads as a status. Dark mode uses a
// translucent tint to keep the same light weight as the light-mode pastels.
const FALLBACK_PALETTE = [
  'bg-sky-100 text-sky-800 dark:bg-sky-400/15 dark:text-sky-300',
  'bg-violet-100 text-violet-800 dark:bg-violet-400/15 dark:text-violet-300',
  'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-400/15 dark:text-fuchsia-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-300',
  'bg-lime-100 text-lime-800 dark:bg-lime-400/15 dark:text-lime-300',
];

function AvatarRoot({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full bg-grey-500 dark:bg-muted',
        className,
      )}
      {...props}
    />
  );
}

function AvatarImage({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Image>) {
  return (
    <AvatarPrimitive.Image
      data-slot="avatar-image"
      className={cn('aspect-square h-full w-full', className)}
      {...props}
    />
  );
}

function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      data-slot="avatar-fallback"
      className={cn(
        'flex h-full w-full items-center justify-center rounded-full bg-grey-500 dark:bg-muted dark:text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}

const avatarFallbackSegmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function getFirstGrapheme(value: string): string {
  if (avatarFallbackSegmenter) {
    return Array.from(avatarFallbackSegmenter.segment(value))[0]?.segment ?? '';
  }

  return Array.from(value)[0] ?? '';
}

function getAvatarFallback(name?: string): string {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return '';
  }

  return getFirstGrapheme(trimmedName).toLocaleUpperCase();
}

export interface AvatarProps {
  src?: string | null;
  alt?: string;
  name?: string;
  colorFromName?: boolean;
  fallback?: ReactNode;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}

function Avatar({
  src,
  alt,
  name,
  colorFromName = false,
  fallback,
  className,
  imageClassName,
  fallbackClassName,
}: AvatarProps) {
  const colorKey = colorFromName
    ? name?.trim().normalize().toLowerCase()
    : undefined;
  const fallbackColor = colorKey
    ? FALLBACK_PALETTE[hashString(colorKey) % FALLBACK_PALETTE.length]
    : undefined;

  return (
    <AvatarRoot className={className}>
      {src ? (
        <AvatarImage src={src} alt={alt} className={imageClassName} />
      ) : null}

      <AvatarFallback className={cn(fallbackColor, fallbackClassName)}>
        {fallback ?? getAvatarFallback(name)}
      </AvatarFallback>
    </AvatarRoot>
  );
}

export { Avatar, AvatarFallback, AvatarImage, AvatarRoot };
