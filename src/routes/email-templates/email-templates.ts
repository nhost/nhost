import path from 'path';
import fs from 'fs';
import { Response } from 'express';
import {
  ContainerTypes,
  ValidatedRequest,
  ValidatedRequestSchema,
} from 'express-joi-validation';

import { ENV } from '@/utils/env';

type BodyType = {
  id: 'verify-email' | 'reset-email' | 'reset-password' | 'magic-link';
  locale: string;
  subject: string;
  html: string;
  text: string;
};

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: BodyType;
}

export const emailTemplatesHandler = async (
  req: ValidatedRequest<Schema>,
  res: Response
): Promise<unknown> => {
  if (req.headers['x-admin-secret'] !== ENV.HASURA_GRAPHQL_ADMIN_SECRET) {
    return res.boom.unauthorized('Incorrect admin secret');
  }

  const { id, locale, subject, html, text } = req.body;

  const emailPath = path.join(ENV.PWD, 'email-templates', locale, id);

  if (subject) {
    fs.writeFileSync(`${emailPath}/subject.txt`, subject);
  }

  if (html) {
    fs.writeFileSync(`${emailPath}/body.html`, html);
  }

  if (text) {
    fs.writeFileSync(`${emailPath}/body.txt`, text);
  }

  return res.send('ok');
};
