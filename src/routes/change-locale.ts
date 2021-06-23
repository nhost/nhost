import { Response, Router } from 'express'
import { request } from '@/request';
import { asyncWrapper } from '@/helpers';
import { changeLocaleByUserId } from '@/queries';
import { LocaleQuery, localeQuery } from '@/validation';
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation';

async function changeLocale(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if(!req.permission_variables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { locale } = req.query

  await request(changeLocaleByUserId, {
    user_id: req.permission_variables['user-id'],
    locale
  })

  req.logger.verbose(`User ${req.permission_variables['user-id']} changed his locale to ${locale}`, {
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