export function generateTicketExpiresAt(seconds: number) {
  const date = new Date();
  date.setSeconds(date.getSeconds() + seconds);
  return date;
}
