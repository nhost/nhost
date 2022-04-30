import { ENV } from './env';

const VERIFY_SIDs = ['VA'];

export const isVerifySid = (
  sid: string = ENV.AUTH_SMS_TWILIO_MESSAGING_SERVICE_ID
) => {
  if (!sid) {
    return false;
  }

  const identifier = sid.substring(0, 2);
  return VERIFY_SIDs.includes(identifier);
};
