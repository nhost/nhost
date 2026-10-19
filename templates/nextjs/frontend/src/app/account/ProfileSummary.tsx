import type { User } from '@nhost/nhost-js/auth';
import AccountSection from '@/app/account/AccountSection';
import AvatarForm from '@/app/account/AvatarForm';
import { avatarFileIdFrom } from '@/app/account/avatar';
import BrowserCheck from '@/app/account/BrowserCheck';
import DisplayNameField from '@/app/account/DisplayNameField';
import EmailField from '@/app/account/EmailField';

// Cut from the ISO string rather than formatted: a locale-formatted date
// would differ between the server render and the browser and trip hydration.
// The auth service returns UTC, and saying so is what makes the time worth
// showing at all.
const whenOf = (iso: string): string =>
  `${iso.slice(0, 16).replace('T', ' ')} UTC`;

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
        <div className="flex flex-col items-center gap-2">
          {user.avatarUrl ? (
            // next/image's optimizer would fetch this route itself and keep the
            // result in a cache shared across visitors. Gravatar or any other
            // origin the backend holds would need a remotePatterns entry.
            // biome-ignore lint/performance/noImgElement: the avatar route needs the visitor's session cookie, which next/image's optimizer does not send
            <img
              src={user.avatarUrl}
              alt=""
              width={256}
              height={256}
              className="size-64 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="size-64 shrink-0 rounded-full bg-muted" />
          )}
          {/* Only a file this app uploaded is ours to delete, so the gravatar
              a fresh account starts with offers no remove button. */}
          <AvatarForm canRemove={Boolean(avatarFileIdFrom(user.avatarUrl))} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <DisplayNameField displayName={user.displayName} />
          <EmailField
            email={user.email}
            verified={user.emailVerified}
            mailboxURL={mailboxURL}
          />
        </div>
      </div>

      {/* Two pairs to a row on anything wider than a phone, so the facts
          that are a word each do not each take a line. The id is the one
          value too long to share a row. */}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[max-content_1fr_max-content_1fr]">
        <dt className="text-muted-foreground">Roles</dt>
        <dd>
          {user.roles.join(', ')}
          <span className="text-muted-foreground">
            {' '}
            (default {user.defaultRole})
          </span>
        </dd>
        <dt className="text-muted-foreground">Locale</dt>
        <dd>{user.locale}</dd>
        <dt className="text-muted-foreground">Two-factor</dt>
        <dd>{user.activeMfaType ? `On (${user.activeMfaType})` : 'Off'}</dd>
        <dt className="text-muted-foreground">Created</dt>
        <dd>{whenOf(user.createdAt)}</dd>
        <dt className="text-muted-foreground">User id</dt>
        <dd className="font-mono text-xs sm:col-span-3">{user.id}</dd>
      </dl>

      {/* Everything above was read by the server. This line is the same
          session read by the browser, which is the other half of the setup
          and the only place the client-side SDK is used. */}
      <BrowserCheck />
    </AccountSection>
  );
}
