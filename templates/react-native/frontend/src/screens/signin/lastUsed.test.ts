import { getDeviceItem, setDeviceItem } from '@/lib/deviceStore';
import {
  lastUsedSignIn,
  promoteSignInAttempt,
  recordSignInAttempt,
} from '@/screens/signin/lastUsed';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('last used sign-in', () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('becomes the attempt once a session starts, and the attempt goes', () => {
    recordSignInAttempt('/auth/otp');
    promoteSignInAttempt();

    expect(lastUsedSignIn()).toBe('/auth/otp');
    expect(getDeviceItem('nhostSignInAttempt')).toBeNull();
  });

  it('stays when there is no attempt to promote', () => {
    recordSignInAttempt('/auth/otp');
    promoteSignInAttempt();
    promoteSignInAttempt();

    expect(lastUsedSignIn()).toBe('/auth/otp');
  });

  it('ignores an attempt older than a day', () => {
    recordSignInAttempt('/auth/otp');
    jest.advanceTimersByTime(DAY_MS);
    promoteSignInAttempt();

    expect(lastUsedSignIn()).toBeNull();
  });

  it('is forgotten after a year', () => {
    recordSignInAttempt('/auth/otp');
    promoteSignInAttempt();
    jest.advanceTimersByTime(365 * DAY_MS);

    expect(lastUsedSignIn()).toBeNull();
  });

  it('reads an entry it cannot parse as none', () => {
    setDeviceItem('nhostLastSignIn', '/auth/otp');

    expect(lastUsedSignIn()).toBeNull();
    expect(getDeviceItem('nhostLastSignIn')).toBeNull();
  });
});
