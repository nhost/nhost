import type { User } from '@nhost/nhost-js/auth';
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
      <CardContent className="flex flex-col gap-4">
        {user.avatarUrl ? (
          // biome-ignore lint/performance/noImgElement: the URL is whatever the backend holds, gravatar by default, and next/image needs every origin listed in next.config
          <img
            src={user.avatarUrl}
            alt=""
            width={64}
            height={64}
            className="size-16 rounded-full"
          />
        ) : null}
        <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-muted-foreground">Email</dt>
          <dd>
            {user.email ?? 'None'}
            <span className="text-muted-foreground">
              {' '}
              {user.emailVerified ? '(verified)' : '(not verified)'}
            </span>
          </dd>
          <dt className="text-muted-foreground">Display name</dt>
          <dd>{user.displayName}</dd>
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
          <dd className="font-mono text-xs">{user.id}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}
