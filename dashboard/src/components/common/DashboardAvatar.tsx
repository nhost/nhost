import { UserRound } from 'lucide-react';
import { Avatar, type AvatarProps } from '@/components/ui/v3/avatar';

const initialsSegmenter =
  typeof Intl.Segmenter === 'function'
    ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    : null;

function firstLetter(value: string): string {
  const letter = initialsSegmenter
    ? Array.from(initialsSegmenter.segment(value))[0]?.segment
    : Array.from(value)[0];
  return (letter ?? '').toLocaleUpperCase();
}

function getInitials(name?: string, email?: string): string {
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return firstLetter(email?.trim() ?? '');
  }

  const names = trimmedName.split(/\s+/);
  const first = firstLetter(names[0]);
  return names.length > 1
    ? first + firstLetter(names[names.length - 1])
    : first;
}

function getPhotoUrl(src: AvatarProps['src']): AvatarProps['src'] {
  if (!src) {
    return src;
  }

  try {
    const url = new URL(src);
    const isGravatar =
      (url.protocol === 'https:' || url.protocol === 'http:') &&
      (url.hostname === 'gravatar.com' ||
        url.hostname.endsWith('.gravatar.com')) &&
      url.pathname.startsWith('/avatar/');

    if (!isGravatar) {
      return src;
    }

    url.searchParams.delete('default');
    url.searchParams.delete('f');
    url.searchParams.delete('forcedefault');
    url.searchParams.set('d', '404');
    return url.toString();
  } catch {
    return src;
  }
}

interface DashboardAvatarProps extends Omit<AvatarProps, 'fallback'> {
  email?: string;
}

export default function DashboardAvatar({
  src,
  name,
  email,
  alt,
  ...props
}: DashboardAvatarProps) {
  const initials = getInitials(name, email);

  return (
    <Avatar
      {...props}
      src={getPhotoUrl(src)}
      name={name}
      alt={alt ?? (name?.trim() || email?.trim() || 'User')}
      fallback={
        initials ? (
          <span className="text-xs leading-none">{initials}</span>
        ) : (
          <UserRound className="h-1/2 w-1/2" role="img" aria-label="User" />
        )
      }
    />
  );
}
