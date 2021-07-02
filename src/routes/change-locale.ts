import { Response, Router } from 'express'
import { asyncWrapper } from '@/helpers';
import { LocaleQuery, localeQuery } from '@/validation';
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation';
import { gqlSdk } from '@/utils/gqlSDK';

async function changeLocale(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if(!req.permissionVariables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { locale } = req.query

  const userId = req.permissionVariables['user-id']

  await gqlSdk.updateUser({
    id: userId,
    user: {
      locale
    }
  })

  req.logger.verbose(`User ${userId} changed his locale to ${locale}`, {
    userId,
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