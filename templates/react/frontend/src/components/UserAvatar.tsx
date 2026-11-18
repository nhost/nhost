import { cn } from '@/lib/utils';

// Falls back to a dot rather than an empty disc: a display name can be an
// empty string, and an account made by magic link often starts that way.
const initialOf = (displayName: string): string =>
  displayName.trim().slice(0, 1).toUpperCase() || '·';

/** The account's initial in a disc. */
export default function UserAvatar({
  displayName,
  className,
}: {
  displayName: string;
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
    </div>
  );
}
