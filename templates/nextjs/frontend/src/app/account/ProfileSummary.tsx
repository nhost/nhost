import type { User } from '@nhost/nhost-js/auth';
import AccountSection, { FieldLabel } from '@/app/account/AccountSection';
import AvatarForm from '@/app/account/AvatarForm';
import DisplayNameField from '@/app/account/DisplayNameField';

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

export default function ProfileSummary({ user }: { user: User }) {
  return (
    <AccountSection
      title="Profile"
      description="What the auth service holds for this account."
    >
      {/* Everything the account is, in one block beside the avatar: the
          name, then the facts under it. Boxed and set apart they were a
          second panel in a section that only has one subject, and they left
          the space beside the avatar empty to do it.

          Left, not centred: centred, the block sat in the middle with space
          on both sides and moved whenever the name's length changed.

          Inset from the section's own padding on both sides, and dropped a
          little below the description. A circle up against an edge reads as
          closer to it than a straight edge does, and keeping the inset even
          moves the facts with the avatar rather than leaving them further
          out than it. */}
      <div className="flex flex-col items-center gap-5 px-4 pt-2 sm:flex-row sm:items-start sm:justify-start sm:gap-6">
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

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* No gap under the label. The field keeps its Edit button down to
              the height of its own text, so the label sits right on the
              value without being pulled into it.

              The email used to sit under this. It lives in Sign-in settings
              now: changing it is a round trip through the inbox, which is a
              page's worth of explaining rather than a field's. */}
          <div className="flex min-w-0 flex-col">
            <FieldLabel>Display name</FieldLabel>
            <DisplayNameField displayName={user.displayName} />
          </div>

          {/* Tight rows: none of this is editable or long, and the space a
              form needs between its fields only pushed the id off the
              avatar's line. Two pairs to a row once there is width for
              them; the id is the one value too long to share. */}
          {/* items-baseline so the id lines up with its label: it is the one
              value in a smaller, monospaced face, and on the grid's default
              stretch its taller line box sat it off the label's line. */}
          <dl className="grid grid-cols-[max-content_1fr] items-baseline gap-x-3 gap-y-0.5 text-sm md:grid-cols-[max-content_1fr_max-content_1fr]">
            {/* The default role on its own. The full list is `user.roles`,
                but it always carries `me` alongside the real one, and
                printing "user, me (default user)" asked a question it then
                answered. */}
            <dt className="text-muted-foreground">Role</dt>
            <dd>{user.defaultRole}</dd>
            <dt className="text-muted-foreground">Created</dt>
            <dd>{whenOf(user.createdAt)}</dd>
            <dt className="text-muted-foreground">Locale</dt>
            <dd>{user.locale}</dd>
            <dt className="text-muted-foreground">2FA</dt>
            <dd>{user.activeMfaType ? `On (${user.activeMfaType})` : 'Off'}</dd>
            <dt className="text-muted-foreground">User id</dt>
            {/* min-w-0 so the truncate can bite: a grid item will not shrink
                below its content without it. */}
            <dd className="min-w-0 truncate font-mono text-xs md:col-span-3">
              {user.id}
            </dd>
          </dl>
        </div>
      </div>
    </AccountSection>
  );
}
