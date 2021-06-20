import { APPLICATION, HEADERS, REGISTRATION } from '@config/index'
import { Response, Router } from 'express'
import { asyncWrapper, isAllowedEmail } from 'src/helpers'
import { WhitelistQuery, whitelistQuery } from 'src/validation'
import { insertAllowedEmail } from 'src/queries'
import { request } from 'src/request'
import { emailClient } from 'src/email'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

async function whitelist(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  try {
  const body = req.body

  if(!REGISTRATION.WHITELIST) {
    return res.boom.notImplemented('Whitelist is disabled')
  }

  if(req.headers[HEADERS.ADMIN_SECRET_HEADER] !== APPLICATION.HASURA_GRAPHQL_ADMIN_SECRET) {
    return res.boom.unauthorized('Incorrect admin secret')
  }

  if(!await isAllowedEmail(body.email)) {
    await request(insertAllowedEmail, {
      email: body.email
    })

    if(body.invite) {
      if(!APPLICATION.EMAILS_ENABLED) {
        return res.boom.badImplementation('Emails have to be enabled when invite=true')
      }

      await emailClient.send({
        template: 'invite',
        message: {
          to: body.email,
        },
        locals: {
          url: APPLICATION.SERVER_URL,
          app_url: APPLICATION.APP_URL,
          app_name: APPLICATION.APP_NAME,
          locale: body.locale,
          email: body.email
        }
      })
    }
  }

  return res.status(204).send()
} catch(e) {
  console.log(e)
}
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: WhitelistQuery
}

export default (router: Router) => {
  router.post('/whitelist', createValidator().body(whitelistQuery), asyncWrapper(whitelist))
}
