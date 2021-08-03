import { JWT } from 'jose';
import fetch, { Response } from 'node-fetch';
import { SuperTest, Test } from 'supertest';

import { APPLICATION } from '../src/config/application';
import { TOKEN } from '../src/config/token';
import { getClaims } from '../src/utils/tokens';
import { Token } from '../src/types';

export interface UserLoginData {
  email: string;
  password: string;
}

export type UserData = UserLoginData & {
  id: string;
  token: string;
  refreshToken: string;
  jwtToken: string;
};

export const generateRandomString = (): string =>
  Math.random().toString(36).replace('0.', '');

export const generateRandomEmail = () =>
  `${generateRandomString()}@${generateRandomString()}.com`;

const getUserId = (token: string): string =>
  token && getClaims(token)['x-hasura-user-id'];

export function withEnv(
  env: Record<string, string>,
  agent: SuperTest<Test>,
  cb: (done: (...args: any[]) => any) => any,
  done: (...args: any[]) => any
) {
  agent
    .post('/change-env')
    .send(env)
    .then(() => {
      cb((...args: any[]) => {
        agent
          .post('/reset-env')
          .then(() => done(...args))
          .catch(() => done(...args));
      });
    });
}

export const createAccountLoginData = (): UserLoginData => ({
  email: `${generateRandomString()}@${generateRandomString()}.com`,
  password: generateRandomString(),
});

export const registerAccount = async (
  agent: SuperTest<Test>,
  customRegisterData: Record<string, unknown> = {}
): Promise<UserLoginData> => {
  const userLoginData = createAccountLoginData();

  return new Promise((resolve, reject) => {
    withEnv(
      {
        REGISTRATION_CUSTOM_FIELDS: Object.keys(customRegisterData).join(','),
        JWT_CUSTOM_FIELDS: Object.keys(customRegisterData).join(','),
        AUTO_ACTIVATE_NEW_USERS: 'true',
        WHITELIST_ENABLED: 'false',
        ADMIN_ONLY_REGISTRATION: 'false',
      },
      agent,
      async (done) => {
        await agent
          .post('/register')
          .send({
            ...userLoginData,
            customRegisterData,
          })
          .then((r) => {
            if (r.body.error) console.log('zzzz', r.body);
            done(userLoginData);
          })
          .catch(reject);
      },
      resolve
    );
  });
};

export const loginAccount = async (
  agent: SuperTest<Test>,
  userLoginData: UserLoginData
): Promise<UserData> => {
  const login = await agent.post('/login').send(userLoginData);

  if (login.body.error) {
    throw new Error(
      `${login.body.statusCode} ${login.body.error}: ${login.body.message}`
    );
  }

  return {
    ...userLoginData,
    token: login.body.jwtToken as string,
    refreshToken: login.body.refreshToken as string,
    jwtToken: login.body.jwtToken as string,
    id: getUserId(login.body.jwtToken),
  };
};

export const registerAndLoginAccount = async (agent: SuperTest<Test>) => {
  return await loginAccount(agent, await registerAccount(agent));
};

interface MailhogEmailAddress {
  Relays: string | null;
  Mailbox: string;
  Domain: string;
  Params: string;
}

interface MailhogMessage {
  ID: string;
  From: MailhogEmailAddress;
  To: MailhogEmailAddress[];
  Content: {
    Headers: {
      'Content-Type': string[];
      Date: string[];
      From: string[];
      'MIME-Version': string[];
      'Message-ID': string[];
      Received: string[];
      'Return-Path': string[];
      Subject: string[];
      To: string[];
      [key: string]: string[];
    };
    Body: string;
    Size: number;
  };
  Created: string;
  Raw: {
    From: string;
    To: string[];
    Data: string;
  };
}

export interface MailhogSearchResult {
  total: number;
  count: number;
  start: number;
  items: MailhogMessage[];
}

export const mailHogSearch = async (
  query: string,
  fields = 'to'
): Promise<MailhogMessage[]> => {
  const response = await fetch(
    `http://${APPLICATION.SMTP_HOST}:8025/api/v2/search?kind=${fields}&query=${query}`
  );
  return ((await response.json()) as MailhogSearchResult).items;
};

export const deleteMailHogEmail = async ({
  ID,
}: MailhogMessage): Promise<Response> => {
  return await fetch(
    `http://${APPLICATION.SMTP_HOST}:8025/api/v1/messages/${ID}`,
    {
      method: 'DELETE',
    }
  );
};

export const deleteAllMailHogEmails = async () => {
  const response = await fetch(
    `http://${APPLICATION.SMTP_HOST}:8025/api/v2/messages`
  );

  const emails = ((await response.json()) as MailhogSearchResult).items;

  emails.forEach(async (message: MailhogMessage) => {
    await deleteMailHogEmail(message);
  });
};

export const deleteEmailsOfAccount = async (email: string): Promise<void> =>
  (await mailHogSearch(email)).forEach(
    async (message) => await deleteMailHogEmail(message)
  );

export const getHeaderFromLatestEmailAndDelete = async (
  email: string,
  header: string
) => {
  const [message] = await mailHogSearch(email);

  if (!message || !message.Content.Headers[header]) return;

  const headerValue = message.Content.Headers[header][0];
  await deleteMailHogEmail(message);

  return headerValue;
};

export const deleteUser = async (
  agent: SuperTest<Test>,
  user: UserLoginData
): Promise<void> => {
  // * Delete the user
  await agent.post('/delete');
  // * Remove any message sent to this user
  await deleteEmailsOfAccount(user.email);
};

/**
 * Verify JWT token and return the Hasura claims.
 * @param authorization Authorization header.
 */
export const isValidAccessToken = (accessToken: string | null): boolean => {
  if (!accessToken) {
    return false;
  }
  try {
    JWT.verify(accessToken, TOKEN.JWT_SECRET);
    return true;
  } catch (err) {
    return false;
  }
};

export const decodeAccessToken = (accessToken: string | null) => {
  if (!accessToken) {
    return null;
  }
  try {
    return JWT.verify(accessToken, TOKEN.JWT_SECRET) as Token;
  } catch (err) {
    return null;
  }
};
