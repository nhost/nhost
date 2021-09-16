import randomNumber from 'random-number-csprng';
import bcrypt from 'bcryptjs';
import { generateTicketExpiresAt } from './ticket';

export const getNewOneTimePasswordData = async () => {
  const pw = await randomNumber(0, 999999);
  const otp = pw.toString().padStart(6, '0');
  const otpHash = await bcrypt.hash(otp, 10);
  const otpHashExpiresAt = generateTicketExpiresAt(5 * 60);

  return {
    otp,
    otpHash,
    otpHashExpiresAt,
  };
};
