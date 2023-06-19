import { createEmailRedirectionLink } from '@/utils';
import { EmailType, EMAIL_TYPES } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { ENV } from '@/utils';

describe('utils', () => {
  it('should create email redirection link', () => {
    const ticket = `${EMAIL_TYPES.PASSWORD_RESET}:${uuidv4()}`;
    const type: EmailType = EMAIL_TYPES.PASSWORD_RESET;
    const redirectTo = "https://hasura.io/";

    const url = createEmailRedirectionLink(type, ticket, redirectTo);

    expect(url).toBe(`${ENV.AUTH_SERVER_URL}/verify?ticket=${encodeURIComponent(ticket)}&type=${encodeURIComponent(type)}&redirectTo=${encodeURIComponent(redirectTo)}`);
  });
});
