import type { AvatarWidth } from '@/app/account/avatar';
import { useAvatarSrc } from '@/app/account/useAvatarSrc';
import { cn } from '@/lib/utils';

// Falls back to a dot rather than an empty disc: a display name can be an
// empty string, and an account made by magic link often starts that way.
const initialOf = (displayName: string): string =>
  displayName.trim().slice(0, 1).toUpperCase() || '·';

/**
 * The account's picture over its initial, so the initial shows wherever the
 * picture does not paint.
 */
export default function UserAvatar({
  avatarUrl,
  displayName,
  width,
  className,
}: {
  avatarUrl: string | undefined;
  displayName: string;
  width: AvatarWidth;
  className?: string;
}) {
  const src = useAvatarSrc(avatarUrl, width);

  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground',
        className,
      )}
    >
      {initialOf(displayName)}
      {src ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </div>
  );
}
