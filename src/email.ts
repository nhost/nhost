// TODO this library takes more than one third of the time required by hasura-auth to load
import Email from 'email-templates';
import nodemailer from 'nodemailer';

import { logger } from './logger';
import { EmailLocals, renderTemplate } from './templates';
import { ENV } from './utils/env';

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
  message: {
    from: ENV.AUTH_SMTP_SENDER,
  },
  send: true,
  render: renderTemplate,
});

export const sendEmail = async (
  options: Parameters<typeof emailClient['send']>[0]
) => {
  try {
    let headers: typeof options['message']['headers'] = {
      ...options.message.headers,
    };

    if (ENV.AUTH_SMTP_X_SMTPAPI_HEADER) {
      headers = {
        ...headers,
        'X-SMTPAPI': ENV.AUTH_SMTP_X_SMTPAPI_HEADER,
      };
    }

    await emailClient.send({
      ...options,
      message: { ...options.message, headers },
    });
  } catch (err) {
    const error = err as Error;
    logger.warn(
      `SMTP error`,
      Object.entries(error).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: value,
        }),
        {}
      )
    );
    logger.warn(`SMTP error context`, {
      template: options.template,
      to: options.message.to,
    });
    throw err;
  }
};
