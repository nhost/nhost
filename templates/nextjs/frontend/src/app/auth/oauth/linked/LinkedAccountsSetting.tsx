import type { User } from '@nhost/nhost-js/auth';
import { configuredProviders, connectHref } from '@/app/auth/oauth/providers';
import { DialogSetting } from '@/components/Setting';
import { listLinkedAccounts } from './actions';
import ManageLinkedAccounts, {
  type LinkedProvider,
} from './ManageLinkedAccounts';

// Fixed locale and zone, as on the profile: this renders on the server.
const day = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeZone: 'UTC',
});

/**
 * The providers the deployment set up, and which of them this account can sign
 * in with.
 */
export default async function LinkedAccountsSetting({ user }: { user: User }) {
  const { links, error } = await listLinkedAccounts();
  const all = links ?? [];

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
  if (error) {
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
      action={linked.length === 0 ? 'Add' : 'Manage'}
      title="Linked accounts"
      description="Sign in to this account with any of these as well."
    >
      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
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
