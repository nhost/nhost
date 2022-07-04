import { JWT } from 'jose';
import fetch, { Response } from 'node-fetch';

import { ENV } from '../src/utils/env';
import { JwtSecret, Token } from '../src/types';
import { request } from './server';
import { StatusCodes } from 'http-status-codes';
import { generateTicketExpiresAt, hashPassword } from '@/utils';
import { ClientBase } from 'pg';
import { v4 as uuidv4 } from 'uuid';

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

interface MailhogSearchResult {
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
    `http://${ENV.AUTH_SMTP_HOST}:8025/api/v2/search?kind=${fields}&query=${query}`
  );
  const jsonBody = await response.json();
  return (jsonBody as MailhogSearchResult).items;
};

const deleteMailHogEmail = async ({
  ID,
}: MailhogMessage): Promise<Response> => {
  return await fetch(
    `http://${ENV.AUTH_SMTP_HOST}:8025/api/v1/messages/${ID}`,
    {
      method: 'DELETE',
    }
  );
};

export const deleteAllMailHogEmails = async () => {
  const response = await fetch(
    `http://${ENV.AUTH_SMTP_HOST}:8025/api/v2/messages`
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

/**
 * Verify JWT token and return the Hasura claims.
 * @param authorization Authorization header.
 */
export const isValidAccessToken = (accessToken: string | null): boolean => {
  if (!accessToken) {
    return false;
  }
  try {
    const jwt = JSON.parse(ENV.HASURA_GRAPHQL_JWT_SECRET) as JwtSecret;
    JWT.verify(accessToken, jwt.key);
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
    const jwt: JwtSecret = JSON.parse(ENV.HASURA_GRAPHQL_JWT_SECRET);
    return JWT.verify(accessToken, jwt.key) as Token;
  } catch (err) {
    return null;
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getUrlParameters = (request: any) => {
  expect(request).toBeObject();
  const { header } = request;
  expect(header).toBeObject();
  expect(header.location).toBeString();
  const url = new URL(header.location);
  return new URLSearchParams(url.search);
};

export const expectUrlParameters = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  request: any
): jest.JestMatchers<string[]> => {
  const params = getUrlParameters(request);
  return expect(Array.from(params.keys()));
};

export const verfiyUserTicket = async (email: string) => {
  // get ticket from email
  const [message] = await mailHogSearch(email);
  expect(message).toBeTruthy();
  const link = message.Content.Headers['X-Link'][0];

  // use ticket to verify email
  const res = await request
    .get(link.replace('http://localhost:4000', ''))
    .expect(StatusCodes.MOVED_TEMPORARILY);

  expectUrlParameters(res).not.toIncludeAnyMembers([
    'error',
    'errorDescription',
  ]);
};

export const insertDbUser = async (
  client: ClientBase,
  email: string,
  password: string,
  verified = true,
  disabled = false
) => {
  const ticket = `verifyEmail:${uuidv4()}`;
  const ticketExpiresAt = generateTicketExpiresAt(60 * 60 * 24 * 30); // 30 days
  const queryString = `INSERT INTO auth.users(display_name, email, password_hash, email_verified, disabled, locale, ticket, ticket_expires_at) 
    VALUES('${email}', '${email}', '${hashPassword(
    password
  )}', '${verified}', '${disabled}','en', '${ticket}', '${ticketExpiresAt.toISOString()}'
    )
    RETURNING id;`;
  return await client.query(queryString);
};

export const getDbUserByEmail = async (client: ClientBase, email: string) => {
  const queryString = `SELECT id FROM auth.users WHERE email = '${email}'`;
  return await client.query(queryString);
};
