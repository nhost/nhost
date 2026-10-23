import { type AvatarWidth, avatarSrc } from '@/app/account/avatar';
import { cn } from '@/lib/utils';

// Falls back to a dot rather than an empty disc: a display name can be an
// empty string, and an account made by magic link often starts that way.
const initialOf = (displayName: string): string =>
  displayName.trim().slice(0, 1).toUpperCase() || '·';

/**
 * The account's picture over its initial, so the initial shows wherever the
 * picture does not paint.
 *
 * The initial is always drawn, not only when there is no URL. The backend
 * gives every new account a gravatar URL with `d=blank`, which for an
 * address Gravatar does not know is a transparent image: a URL that is set
 * but draws nothing. Drawing the initial under it is what keeps the nav
 * link visible for the ordinary new account, and covers a picture that
 * fails to load the same way.
 *
 * Shared by the nav and the profile, which want the same thing at different
 * sizes. `className` carries the size and the type scale that goes with it.
 * `width` is the pixels to ask storage for, which is the CSS size doubled so
 * it holds up on a dense screen.
 *
 * Decorative in both: whatever sits around it already names the account, so
 * the whole thing is hidden and the image has an empty alt.
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
        // result in a cache shared across visitors. Gravatar or any other
        // origin the backend holds would need a remotePatterns entry. The
        // resizing it would have done is asked of storage instead, by the
        // `?w=` that `avatarSrc` puts on the URL.
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
