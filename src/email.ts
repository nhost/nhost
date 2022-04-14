// TODO this library takes more than one third of the time required by hasura-auth to load
import Email from 'email-templates';
import nodemailer from 'nodemailer';
import fs from 'fs';
import axios from 'axios';
import urlJoin from 'url-join';

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

const getFileName = (view: string, locals: Record<string, string>) => {
  // generate path to template
  const viewSplit = view.split('/');
  const id = viewSplit[0];
  const field = viewSplit[1] as EmailField;
  const { locale } = locals;
  const fileName = convertFieldToFileName(field);
  return `${locale}/${id}/${fileName}`;
};

const readFile = (view: string, locals: Record<string, string>): string => {
  const { locale } = locals;
  const fullPath = path.join(
    ENV.PWD,
    'email-templates',
    getFileName(view, locals)
  );
  logger.debug(`Using email template: ${fullPath}`);
  try {
    return fs.readFileSync(fullPath).toString();
  } catch (error) {
    if (locale !== ENV.AUTH_LOCALE_DEFAULT)
      return readFile(view, { ...locals, locale: ENV.AUTH_LOCALE_DEFAULT });
    else {
      logger.warn(`No template found at ${fullPath}`);
      throw Error();
    }
  }
};

const readRemoteTemplate = async (
  view: string,
  locals: Record<string, string>
): Promise<string> => {
  const { locale } = locals;
  const fileName = getFileName(view, locals);
  const url = urlJoin(ENV.AUTH_EMAIL_TEMPLATE_FETCH_URL, fileName);
  logger.debug(`Using email template: ${url}`);
  try {
    const result = await axios.get(url);
    return result.data;
  } catch (error) {
    if (locale !== ENV.AUTH_LOCALE_DEFAULT)
      return readRemoteTemplate(view, {
        ...locals,
        locale: ENV.AUTH_LOCALE_DEFAULT,
      });
    else {
      logger.warn(`No template found at ${url}`);
      throw Error();
    }
  }
};

/**
 * Reusable email client.
 */
export const emailClient = new Email({
  transport,
  message: { from: ENV.AUTH_SMTP_SENDER },
  send: true,
  render: async (view, locals) => {
    try {
      const content = ENV.AUTH_EMAIL_TEMPLATE_FETCH_URL
        ? await readRemoteTemplate(view, locals)
        : readFile(view, locals);
      return templateEngine({ content, variables: locals });
    } catch (error) {
      return null;
    }
  },
});
