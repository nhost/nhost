import type { User } from '@nhost/nhost-js/auth';
import AvatarForm from '@/app/account/AvatarForm';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

// The date is cut rather than formatted: a locale-formatted string would
// differ between the server render and the browser and trip hydration.
const dateOf = (iso: string): string => iso.slice(0, 10);

export default function ProfileSummary({ user }: { user: User }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>
          What the auth service holds for this account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* The avatar is shown once, here, next to the name and email it
            belongs to. The upload control sits under it in the same card so
            the image and the form that replaces it are not two sections. */}
        <div className="flex items-center gap-4">
          {user.avatarUrl ? (
            // next/image's optimizer would fetch this route itself and keep the
            // result in a cache shared across visitors. Gravatar or any other
            // origin the backend holds would need a remotePatterns entry.
            // biome-ignore lint/performance/noImgElement: the avatar route needs the visitor's session cookie, which next/image's optimizer does not send
            <img
              src={user.avatarUrl}
              alt=""
              width={56}
              height={56}
              className="size-14 shrink-0 rounded-full"
            />
          ) : (
            <div className="size-14 shrink-0 rounded-full bg-muted" />
          )}
          <div className="min-w-0">
            <div className="truncate font-medium">{user.displayName}</div>
            <div className="truncate text-muted-foreground text-sm">
              {user.email ?? 'None'}{' '}
              {user.emailVerified ? '(verified)' : '(not verified)'}
            </div>
          </div>
        </div>

        <AvatarForm />

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
          <dd>{dateOf(user.createdAt)}</dd>
          <dt className="text-muted-foreground">User id</dt>
          <dd className="font-mono text-xs sm:col-span-3">{user.id}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
