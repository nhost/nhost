/** Marks the way the visitor last signed in on the sign-in list. */
export default function LastUsedBadge() {
  return (
    <span className="absolute -top-2 right-2 rounded-full bg-primary px-2 py-0.5 font-semibold text-[0.6875rem] text-primary-foreground leading-none shadow-sm">
      Last used
    </span>
  );
}
