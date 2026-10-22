/**
 * Marks the way the visitor last signed in on the sign-in list. Inside the
 * link, so it is read out as part of the link's name, and pinned to the link's
 * top-right corner, so the link has to be `relative`. It sits on the border,
 * half outside, which is why the list spaces its links wider than the badge
 * reaches out.
 */
export default function LastUsedBadge() {
  return (
    <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 font-semibold text-[0.6875rem] text-primary-foreground leading-none shadow-sm">
      Last used
    </span>
  );
}
