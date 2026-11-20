import {
  alreadyRegistered,
  noPasskeyHere,
  wasCancelled,
} from '@/screens/auth/passkey/cancelled';

const rejection = (error: string) => ({ error, message: error });

describe('wasCancelled', () => {
  it('counts a dismissed or timed-out prompt as cancelled', () => {
    expect(wasCancelled(rejection('UserCancelled'))).toBe(true);
    expect(wasCancelled(rejection('TimedOut'))).toBe(true);
  });

  it('counts any other failure as an error', () => {
    for (const error of ['NoCredentials', 'RequestFailed', 'UnknownError']) {
      expect(wasCancelled(rejection(error))).toBe(false);
    }
    expect(wasCancelled(new Error('UserCancelled'))).toBe(false);
    expect(wasCancelled(null)).toBe(false);
  });
});

it('tells the other outcomes apart by name', () => {
  expect(noPasskeyHere(rejection('NoCredentials'))).toBe(true);
  expect(noPasskeyHere(rejection('UserCancelled'))).toBe(false);
  expect(alreadyRegistered(rejection('CredentialAlreadyExists'))).toBe(true);
  expect(alreadyRegistered(rejection('TimedOut'))).toBe(false);
});
