import type { User } from '@nhost/nhost-js/auth';
import AccountSection, { FieldLabel } from '@/app/account/AccountSection';
import AvatarForm from '@/app/account/AvatarForm';
import DisplayNameField from '@/app/account/DisplayNameField';
import EmailField from '@/app/account/EmailField';

// Cut from the ISO string rather than formatted: a locale-formatted date
// would differ between the server render and the browser and trip hydration.
// The auth service returns UTC, and saying so is what makes the time worth
// showing at all.
const whenOf = (iso: string): string =>
  `${iso.slice(0, 16).replace('T', ' ')} UTC`;

// Falls back to a dot rather than an empty disc: a display name can be an
// empty string, and an account made by magic link often starts that way.
const initialOf = (displayName: string): string =>
  displayName.trim().slice(0, 1).toUpperCase() || '·';

export default function ProfileSummary({
  user,
  mailboxURL,
}: {
  user: User;
  mailboxURL: string | null;
}) {
  return (
    <AccountSection
      title="Profile"
      description="What the auth service holds for this account."
    >
      {/* The avatar and the two things it belongs to. Both are editable where
          they are read, so there is no second copy of either further down the
          page. Stacked on a phone, side by side once there is room. */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
        {/* Nothing to take down when the account has no avatar at all. */}
        <AvatarForm canRemove={Boolean(user.avatarUrl)}>
          {user.avatarUrl ? (
            // next/image's optimizer would fetch this route itself and keep the
            // result in a cache shared across visitors. Gravatar or any other
            // origin the backend holds would need a remotePatterns entry.
            // biome-ignore lint/performance/noImgElement: the avatar route needs the visitor's session cookie, which next/image's optimizer does not send
            <img
              src={user.avatarUrl}
              alt=""
              width={96}
              height={96}
              className="block size-24 shrink-0 rounded-full object-cover"
            />
          ) : (
            // The initial rather than an empty disc, so an account with no
            // image still has something of its own there.
            <div
              aria-hidden="true"
              className="flex size-24 shrink-0 items-center justify-center rounded-full bg-muted font-medium text-3xl text-muted-foreground"
            >
              {initialOf(user.displayName)}
            </div>
          )}
        </AvatarForm>

        {/* No gap under either label. The fields keep their controls down to
            the height of their own text, so the label sits right on the
            value without being pulled into it. */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex min-w-0 flex-col">
            <FieldLabel>Display name</FieldLabel>
            <DisplayNameField displayName={user.displayName} />
          </div>
          <div className="flex min-w-0 flex-col">
            <FieldLabel>Email</FieldLabel>
            <EmailField
              email={user.email}
              verified={user.emailVerified}
              mailboxURL={mailboxURL}
            />
          </div>
        </div>
      </div>

      {/* Boxed and labelled, because none of it is editable and without a
          frame it read as more of the fields above. Two pairs to a row on
          anything wider than a phone, so the facts that are a word each do
          not each take a line; the id is the one too long to share. */}
      <div className="flex flex-col gap-2 rounded-lg border p-4">
        <FieldLabel>Account details</FieldLabel>
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr_max-content_1fr]">
          {/* The default role on its own. The full list is `user.roles`, but
              it always carries `me` alongside the real one, and printing
              "user, me (default user)" asked a question it then answered. */}
          <dt className="text-muted-foreground">Role</dt>
          <dd>{user.defaultRole}</dd>
          <dt className="text-muted-foreground">Locale</dt>
          <dd>{user.locale}</dd>
          <dt className="text-muted-foreground">Two-factor</dt>
          <dd>{user.activeMfaType ? `On (${user.activeMfaType})` : 'Off'}</dd>
          <dt className="text-muted-foreground">Created</dt>
          <dd>{whenOf(user.createdAt)}</dd>
          <dt className="text-muted-foreground">User id</dt>
          <dd className="font-mono text-xs sm:col-span-3">{user.id}</dd>
        </dl>
      </div>
    </AccountSection>
  );
}
