import * as AvatarPrimitive from '@radix-ui/react-avatar';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

function AvatarRoot({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      data-slot="avatar"
      className={cn(
        'relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full',
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
        'flex h-full w-full items-center justify-center rounded-full bg-muted',
        className,
      )}
      {...props}
    />
  );
}

function getInitials(name?: string) {
  if (!name) {
    return '';
  }

  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
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
  return (
    <AvatarRoot className={className}>
      {src ? (
        <AvatarImage src={src} alt={alt} className={imageClassName} />
      ) : null}

      <AvatarFallback className={fallbackClassName}>
        {fallback ?? getInitials(name ?? alt)}
      </AvatarFallback>
    </AvatarRoot>
  );
}

export { Avatar, AvatarFallback, AvatarImage, AvatarRoot };
