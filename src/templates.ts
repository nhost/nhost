import axios from 'axios';
import path from 'path';
import fs from 'fs';
import urlJoin from 'url-join';
import { logger } from './logger';
import { ENV } from './utils';

type TemplateEngineProps = {
  content: string;
  variables: EmailLocals | SmsLocals;
};

const templateEngine = ({ content, variables }: TemplateEngineProps) => {
  let templatedContent = content;

  for (const k in variables) {
    const key = k as keyof (EmailLocals | SmsLocals);
    const regex = new RegExp(`\\\${${key}}`, 'g');
    const value = variables[key];
    if (value !== null) {
      templatedContent = templatedContent.replace(regex, value);
    }
  }

  return templatedContent;
};

type EmailField = 'subject' | 'html' | 'text';
type SmsField = 'text';

const convertFieldToFileName = (field: EmailField | SmsField) => {
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

const getFileName = (view: string, locals: EmailLocals | SmsLocals) => {
  // generate path to template
  const viewSplit = view.split('/');
  const id = viewSplit[0];
  const field = viewSplit[1] as EmailField | SmsField;
  const { locale } = locals;
  const fileName = convertFieldToFileName(field);
  return `${locale}/${id}/${fileName}`;
};

const readFile = (view: string, locals: EmailLocals | SmsLocals): string => {
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
    if (locale !== ENV.AUTH_LOCALE_DEFAULT) {
      logger.debug(
        `No template found at ${fullPath}, falling back to default locale ${ENV.AUTH_LOCALE_DEFAULT}`
      );
      return readFile(view, { ...locals, locale: ENV.AUTH_LOCALE_DEFAULT });
    } else {
      throw Error();
    }
  }
};

/** @deprecated */
const readRemoteTemplate = async (
  view: string,
  locals: EmailLocals | SmsLocals
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

type CommonLocals = {
  displayName: string;
  locale: string;
};

export type SmsLocals = CommonLocals & {
  code: string;
};

export type EmailLocals = CommonLocals & {
  link: string;
  email: string;
  newEmail: string | null;
  ticket: string;
  redirectTo: string;
  serverUrl: string;
  clientUrl: string;
};

export const renderTemplate = async (
  view: string,
  locals: EmailLocals | SmsLocals
) => {
  try {
    const content = ENV.AUTH_EMAIL_TEMPLATE_FETCH_URL
      ? await readRemoteTemplate(view, locals)
      : readFile(view, locals);
    return templateEngine({ content, variables: locals });
  } catch (error) {
    return null;
  }
};
