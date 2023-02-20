import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Input from '@/ui/v2/Input';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { triggerToast } from '@/utils/toast';
import React, { useState } from 'react';

export function ChangePasswordModal({ close }: any) {
  const [formState, setFormState] = useState<{
    loading: boolean;
    error: null | string;
  }>({
    loading: false,
    error: null,
  });

  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();

    setFormState({
      loading: true,
      error: null,
    });

    if (newPassword !== newPasswordConfirm) {
      setFormState({
        loading: false,
        error: 'Passwords do not match',
      });

      return;
    }

    const { error } = await nhost.auth.changePassword({ newPassword });

    if (error) {
      setFormState({
        loading: false,
        error: error.message,
      });

      return;
    }

    triggerToast(`Your password has been updated`);
    close();
  };

  return (
    <Box className="w-full max-w-md rounded-md px-6 py-6 text-left">
      <form onSubmit={handleSubmit}>
        <div className="grid grid-flow-row gap-4">
          <div className="grid grid-flow-row gap-2">
            <Text variant="h3">Choose New Password</Text>

            <Text className="mt-2 font-normal">
              Make sure to pick a strong password with at least 8 characters.
            </Text>
          </div>

          <div className="grid grid-flow-row gap-2">
            <Input
              type="password"
              id="newPassword"
              name="newPassword"
              label="New Password"
              placeholder="New password"
              autoFocus
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              hideEmptyHelperText
              fullWidth
              required
            />

            <Input
              type="password"
              id="confirmNewPassword"
              name="confirmNewPassword"
              label="Confirm New Password"
              placeholder="Confirm new password"
              value={newPasswordConfirm}
              onChange={(event) => setNewPasswordConfirm(event.target.value)}
              hideEmptyHelperText
              fullWidth
              required
            />
          </div>

          <div className="grid grid-flow-row gap-2">
            {formState.error && (
              <Text className="w-full px-4 text-center" color="error">
                Error: {formState.error}
              </Text>
            )}

            <Button type="submit" loading={formState.loading}>
              Set New Password
            </Button>

            <Button
              type="reset"
              variant="outlined"
              color="secondary"
              onClick={close}
            >
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </Box>
  );
}

export default ChangePasswordModal;
