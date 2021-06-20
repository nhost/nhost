import { Response, Router } from 'express'

import { changeEmailByUserId } from 'src/queries'
import { request } from 'src/request'
import { RequestExtended } from 'src/types'
import { AUTHENTICATION } from '@config/index'
import { ContainerTypes, createValidator, ValidatedRequestSchema } from 'express-joi-validation'
import { emailResetSchema, EmailResetSchema } from 'src/validation'
import { accountWithEmailExists, asyncWrapper } from 'src/helpers'

async function directChange(req: RequestExtended<Schema>, res: Response): Promise<unknown> {
  if(AUTHENTICATION.VERIFY_EMAILS) {
    return res.boom.badImplementation(`Please set the VERIFY_EMAILS env variable to false to use the auth/change-email route.`)
  }

  const user_id = req.permission_variables?.['user-id']

  const new_email = req.body.new_email

  if(await accountWithEmailExists(new_email)) {
    return res.boom.badRequest('Cannot use this email')
  }

  // * Email verification is not activated - change email straight away
  await request(changeEmailByUserId, { user_id, new_email })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: EmailResetSchema
}

export default (router: Router) => {
  router.post('/', createValidator().body(emailResetSchema), asyncWrapper(directChange))
}
