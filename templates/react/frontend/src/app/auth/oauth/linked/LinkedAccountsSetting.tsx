import type { User } from '@nhost/nhost-js/auth';
import { listLinkedAccounts } from '@/app/auth/oauth/linked/actions';
import ManageLinkedAccounts, {
  type LinkedProvider,
} from '@/app/auth/oauth/linked/ManageLinkedAccounts';
import { configuredProviders, connectHref } from '@/app/auth/oauth/providers';
import { DialogSetting } from '@/components/Setting';
import { useLoad } from '@/lib/useLoad';

// Fixed locale and zone, as on the profile.
const day = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

/**
 * The providers the deployment set up, and which of them this account can sign
 * in with.
 */
export default function LinkedAccountsSetting({ user }: { user: User }) {
  const loaded = useLoad(listLinkedAccounts);
  const all = loaded?.links ?? [];

  const providers: LinkedProvider[] = configuredProviders().map(
    ({ id, name }) => {
      const link = all.find(({ providerId }) => providerId === id);
      return {
        id,
        name,
        connectHref: connectHref(id),
        link: link
          ? { id: link.id, since: day.format(new Date(link.createdAt)) }
          : undefined,
      };
    },
  );
  const linked = providers.filter(({ link }) => link);

  let value: string;
  if (!loaded) {
    value = 'Loading…';
  } else if (loaded.error) {
    value = 'Could not load';
  } else if (linked.length === 0) {
    value = 'None';
  } else {
    value = linked.map(({ name }) => name).join(', ');
  }

  return (
    <DialogSetting
      label="Linked accounts"
      value={value}
      action={loaded && linked.length === 0 ? 'Add' : 'Manage'}
      title="Linked accounts"
      description="Sign in to this account with any of these as well."
    >
      {!loaded ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : loaded.error ? (
        <p role="alert" className="text-destructive text-sm">
          {loaded.error}
        </p>
      ) : (
        <ManageLinkedAccounts
          providers={providers}
          email={user.email}
          links={all.length}
        />
      )}
    </DialogSetting>
  );
}
