// TODO this library takes more than one third of the time required by hasura-auth to load
import Email from 'email-templates';
import nodemailer from 'nodemailer';

import { ENV } from './utils/env';
import { EmailLocals, renderTemplate } from './templates';

/**
 * SMTP transport.
 */
const transport = nodemailer.createTransport({
  host: ENV.AUTH_SMTP_HOST,
  port: Number(ENV.AUTH_SMTP_PORT),
  secure: Boolean(ENV.AUTH_SMTP_SECURE),
  auth: {
    pass: ENV.AUTH_SMTP_PASS,
    user: ENV.AUTH_SMTP_USER,
  },
  authMethod: ENV.AUTH_SMTP_AUTH_METHOD,
});

/**
 * Reusable email client.
 */
export const emailClient = new Email<EmailLocals>({
  transport,
  message: { from: ENV.AUTH_SMTP_SENDER },
  send: true,
  render: renderTemplate,
});
