import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { hashString } from '@/utils/hashString';

const FALLBACK_PALETTE = [
  'bg-violet-100 text-violet-900 dark:bg-violet-900 dark:text-violet-100',
  'bg-sky-100 text-sky-900 dark:bg-sky-900 dark:text-sky-100',
  'bg-teal-100 text-teal-900 dark:bg-teal-900 dark:text-teal-100',
  'bg-rose-100 text-rose-900 dark:bg-rose-900 dark:text-rose-100',
  'bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100',
  'bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100',
  'bg-indigo-100 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100',
  'bg-fuchsia-100 text-fuchsia-900 dark:bg-fuchsia-900 dark:text-fuchsia-100',
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
  fallback?: ReactNode;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
}

function Avatar({
  src,
  alt,
  name,
  fallback,
  className,
  imageClassName,
  fallbackClassName,
}: AvatarProps) {
  const colorKey = name?.trim().normalize().toLowerCase();
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
