import Email from 'email-templates';
import nodemailer from 'nodemailer';
import fs from 'fs';

import { ENV } from './utils/env';
import path from 'path';
import { logger } from './logger';

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

type TemplateEngineProps = {
  content: string;
  variables: {
    [key: string]: string;
  };
};

const templateEngine = ({ content, variables }: TemplateEngineProps) => {
  let templatedContent = content;

  for (const key in variables) {
    const regex = new RegExp(`\\\${${key}}`, 'g');
    templatedContent = templatedContent.replace(regex, variables[key]);
  }

  return templatedContent;
};

type EmailField = 'subject' | 'html' | 'text';

const convertFieldToFileName = (field: EmailField) => {
  if (field === 'subject') {
    return 'subject.txt';
  }

  if (field === 'html') {
    return 'body.html';
  }

  if (field === 'text') {
    return 'body.txt';
  }

  return null;
};

/**
 * Reusable email client.
 */
export const emailClient = new Email({
  transport,
  message: { from: ENV.AUTH_SMTP_SENDER },
  send: true,
  render: async (view, locals) => {
    const viewSplit = view.split('/');

    const id = viewSplit[0];
    const field = viewSplit[1] as EmailField;
    const { locale } = locals;

    // generate path to template
    const emailPath = path.join(ENV.PWD, 'email-templates', locale, id);

    const fileName = convertFieldToFileName(field);

    const fullPath = `${emailPath}/${fileName}`;

    logger.debug(`Using email template: ${fullPath}`);

    let content;
    try {
      content = fs.readFileSync(fullPath).toString();
    } catch (error) {
      logger.warn(`No template found at ${fullPath}`);
      return null;
    }

    return templateEngine({ content, variables: locals });
  },
});
