import {
  endPasswordReset,
  pendingPasswordReset,
  startPasswordReset,
} from '@/lib/nhost/passwordReset';
import { mockDevice } from '@/test/device';

describe('password reset marker', () => {
  it('holds the reset screen until the reset ends', () => {
    startPasswordReset('/auth/password/reset');
    expect(pendingPasswordReset()).toBe('/auth/password/reset');

    endPasswordReset();
    expect(pendingPasswordReset()).toBeNull();
  });

  // As the session, it has to survive the app being killed mid-reset.
  it('lives on the device', () => {
    startPasswordReset('/auth/password/reset');

    expect(mockDevice().secureStore.get('nhostPasswordReset')).toBe(
      '/auth/password/reset',
    );
  });
});
