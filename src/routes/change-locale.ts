import { Response, Router } from 'express'
import { RequestExtended } from 'src/types';
import { request } from 'src/request';
import { asyncWrapper } from 'src/helpers';
import { changeLocaleByUserId } from 'src/queries';
import { LocaleQuery, localeQuery } from 'src/validation';
import { ValidatedRequestSchema, ContainerTypes, createValidator } from 'express-joi-validation';

async function changeLocale(req: RequestExtended<Schema>, res: Response): Promise<unknown> {
  if(!req.permission_variables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { locale } = req.query

  await request(changeLocaleByUserId, {
    user_id: req.permission_variables['user-id'],
    locale
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Query]: LocaleQuery
}

export default (router: Router) => {
  router.post('/change-locale', createValidator().query(localeQuery), asyncWrapper(changeLocale))
}