import { type AvatarWidth, avatarSrc } from '@/app/account/avatar';
import { cn } from '@/lib/utils';

// Falls back to a dot rather than an empty disc: a display name can be an
// empty string, and an account made by magic link often starts that way.
const initialOf = (displayName: string): string =>
  displayName.trim().slice(0, 1).toUpperCase() || '·';

/**
 * The account's picture, or its initial when there is none.
 *
 * Shared by the nav and the profile, which want the same thing at different
 * sizes. `className` carries the size and, for the fallback, the type scale
 * that goes with it. `width` is the pixels to ask storage for, which is the
 * CSS size doubled so it holds up on a dense screen.
 *
 * Decorative in both: whatever sits around it already names the account, so
 * the image has an empty alt and the fallback is hidden outright.
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
  if (avatarUrl) {
    return (
      // next/image's optimizer would fetch this route itself and keep the
      // result in a cache shared across visitors. Gravatar or any other
      // origin the backend holds would need a remotePatterns entry. The
      // resizing it would have done is asked of storage instead, by the
      // `?w=` that `avatarSrc` puts on the URL.
      // biome-ignore lint/performance/noImgElement: the avatar route needs the visitor's session cookie, which next/image's optimizer does not send
      <img
        src={avatarSrc(avatarUrl, width)}
        alt=""
        className={cn('block shrink-0 rounded-full object-cover', className)}
      />
    );
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-muted-foreground',
        className,
      )}
    >
      {initialOf(displayName)}
    </div>
  );
}
