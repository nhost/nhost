import { v4 as uuidv4 } from 'uuid';

export function generateTicketExpiresAt(seconds: number) {
  const date = new Date();
  date.setSeconds(date.getSeconds() + seconds);
  return date;
}

export const createVerifyEmailTicket = () => ({
  ticket: `verifyEmail:${uuidv4()}`,
  ticketExpiresAt: generateTicketExpiresAt(60 * 60 * 24 * 30), // 30 days
});
