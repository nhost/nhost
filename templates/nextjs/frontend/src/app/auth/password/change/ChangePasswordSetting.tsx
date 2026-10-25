import ChangePasswordForm from '@/app/auth/password/change/ChangePasswordForm';
import { DialogSetting } from '@/components/Setting';

// The value is a mask, not a fact: the auth service never says whether an
// account has a password, and one made by magic link has none until it is
// set here. Being signed in authorises the change, so the current password
// is not asked for.
export default function ChangePasswordSetting() {
  return (
    <DialogSetting
      label="Password"
      value="••••••••"
      action="Change"
      title="Change password"
      description="You'll be signed out everywhere, this device included."
    >
      <ChangePasswordForm />
    </DialogSetting>
  );
}
