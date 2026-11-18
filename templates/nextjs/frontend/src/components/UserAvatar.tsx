import { type AvatarWidth, avatarSrc } from '@/app/account/avatar';
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
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted font-medium text-muted-foreground',
        className,
      )}
    >
      {initialOf(displayName)}
      {avatarUrl ? (
        // next/image's optimizer would fetch this route itself and keep the
        // result in a cache shared across visitors.
        // biome-ignore lint/performance/noImgElement: the avatar route needs the visitor's session cookie, which next/image's optimizer does not send
        <img
          src={avatarSrc(avatarUrl, width)}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </div>
  );
}
