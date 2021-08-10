import Email from 'email-templates';
import nodemailer from 'nodemailer';
import ejs from 'ejs';

import { gqlSdk } from './utils/gqlSDK';
import { ENV } from './utils/env';

/**
 * SMTP transport.
 */
const transport = nodemailer.createTransport({
  host: ENV.SMTP_HOST,
  port: Number(ENV.SMTP_PORT),
  secure: Boolean(ENV.SMTP_SECURE),
  auth: {
    pass: ENV.SMTP_PASS,
    user: ENV.SMTP_USER,
  },
  authMethod: ENV.SMTP_AUTH_METHOD,
});

/**
 * Reusable email client.
 */
export const emailClient: Email<any> = new Email({
  transport,
  message: { from: ENV.SMTP_SENDER },
  send: true,
  render: async (view, locals) => {
    const [id, field] = view.split('/');
    const locale = locals.locale;

    if (!locale) {
      throw new Error('Cannot send email without locale');
    }

    const email = await gqlSdk
      .emailTemplate({
        id,
        locale,
      })
      .then((res) => res.AuthEmailTemplate);

    if (!email) {
      throw new Error(`Cannot find email ${id}(${locale})`);
    }

    if (field === 'subject') return email.title;
    else if (field === 'html')
      return await emailClient.juiceResources(ejs.render(email.html, locals));
    else if (field === 'text') return email.noHtml;
    else throw new Error(`Unknown field ${field}`);
  },
});
