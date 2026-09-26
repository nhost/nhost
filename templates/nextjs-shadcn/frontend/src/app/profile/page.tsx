import { PROFILE_DESCRIPTION, PROFILE_TITLE } from '@/app/profile/copy';
import { ProfilePanel } from '@/app/profile/ProfilePanel';

export const dynamic = 'force-dynamic';

/**
 * `/profile` on its own: a direct load, a refresh, or a bookmark. Reaching it
 * from the account menu gets the modal in `@modal/(.)profile` instead, off the
 * same URL and the same panel.
 */
export default function Profile() {
  return (
    <div className="flex flex-col gap-8 pb-32">
      <div className="flex flex-col gap-2">
        <h1 className="font-bold text-3xl tracking-tight">{PROFILE_TITLE}</h1>
        <p className="text-muted-foreground">{PROFILE_DESCRIPTION}</p>
      </div>

      <ProfilePanel />
    </div>
  );
}
