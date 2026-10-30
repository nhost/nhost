import type { User } from '@nhost/nhost-js/auth';
import ChangePasswordForm from '@/app/auth/password/change/ChangePasswordForm';
import { DialogSetting } from '@/components/Setting';

// The value is a mask, not a fact: the auth service never says whether an
// account has a password, and one made by magic link has none until it is set
// here.
export default function ChangePasswordSetting({ user }: { user: User }) {
  const staysSignedIn = Boolean(user.email);

  return (
    <DialogSetting
      label="Password"
      value="••••••••"
      action="Change"
      title="Change password"
      description={
        staysSignedIn
          ? "Your other devices will be signed out. You'll stay signed in here."
          : "You'll be signed out everywhere, this device included."
      }
    >
      <ChangePasswordForm needsCode={user.activeMfaType === 'totp'} />
    </DialogSetting>
  );
}
