import randomNumber from 'random-number-csprng';
import bcrypt from 'bcryptjs';
import { generateTicketExpiresAt } from './ticket';

export const getOtpData = async () => {
  const otpInt = await randomNumber(0, 999999);
  const otp = otpInt.toString().padStart(6, '0');
  const otpHash = await bcrypt.hash(otp, 10);
  const otpHashExpiresAt = generateTicketExpiresAt(10 * 60);

  return {
    otp,
    otpHash,
    otpHashExpiresAt,
  };
};
