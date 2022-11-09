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

export const isTestingPhoneNumber = (phoneNumber?: string | null) => {
  const testPhoneNumbers = ENV.AUTH_SMS_TEST_PHONE_NUMBERS as string[];

  return phoneNumber && testPhoneNumbers.indexOf(phoneNumber) > -1;
};
