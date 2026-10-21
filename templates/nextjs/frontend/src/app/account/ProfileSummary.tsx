import type { User } from '@nhost/nhost-js/auth';
import AccountSection, { FieldLabel } from '@/app/account/AccountSection';
import AvatarForm from '@/app/account/AvatarForm';
import DisplayNameField from '@/app/account/DisplayNameField';
import UserAvatar from '@/components/UserAvatar';

// Cut from the ISO string rather than formatted: a locale-formatted date
// would differ between the server render and the browser and trip hydration.
// The auth service returns UTC, and saying so is what makes the time worth
// showing at all.
const whenOf = (iso: string): string =>
  `${iso.slice(0, 16).replace('T', ' ')} UTC`;

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
      <div className="flex flex-col items-center gap-5 px-4 pt-2 sm:flex-row sm:items-start sm:justify-start sm:gap-8">
        {/* Nothing to take down when the account has no avatar at all. */}
        <AvatarForm canRemove={Boolean(user.avatarUrl)}>
          <UserAvatar
            avatarUrl={user.avatarUrl}
            displayName={user.displayName}
            width={192}
            className="size-24 text-3xl"
          />
        </AvatarForm>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
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

          {/* Tight rows: none of this is editable. Two pairs to a row once
              there is width for them. Two-factor is not here: it is in
              Sign-in settings, with the way to change it. */}
          {/* Every value in the id's smaller, monospaced face: these are
              what the auth service stores, read back as stored, and one
              face for all of them keeps the id from looking like the odd
              one out. items-baseline so each lines up with its label, which
              is in the larger sans face; on the grid's default stretch the
              taller line box sat the value off the label's line. */}
          {/* The first pair's value column is only as wide as its values,
              which are short, so the second pair sits close beside it
              rather than halfway across the row; pl-6 is what still tells
              the pairs apart. The id is the long one, so it takes the last
              column, the one that gives way. */}
          <dl className="grid grid-cols-[max-content_1fr] items-baseline gap-x-3 gap-y-0.5 text-sm md:grid-cols-[max-content_max-content_max-content_1fr] [&_dd]:font-mono [&_dd]:text-xs">
            {/* The default role on its own. The full list is `user.roles`,
                but it always carries `me` alongside the real one, and
                printing "user, me (default user)" asked a question it then
                answered. */}
            <dt className="text-muted-foreground">Role</dt>
            <dd>{user.defaultRole}</dd>
            <dt className="text-muted-foreground md:pl-6">User id</dt>
            {/* min-w-0 so the truncate can bite: a grid item will not shrink
                below its content without it. The title has the whole id for
                when it is cut short. */}
            <dd className="min-w-0 truncate" title={user.id}>
              {user.id}
            </dd>
            <dt className="text-muted-foreground">Locale</dt>
            <dd>{user.locale}</dd>
            <dt className="text-muted-foreground md:pl-6">Created</dt>
            <dd>{whenOf(user.createdAt)}</dd>
          </dl>
        </div>
      </div>
    </AccountSection>
  );
}
