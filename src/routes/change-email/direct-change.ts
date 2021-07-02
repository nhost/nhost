import { Response, Router } from 'express'

import { AUTHENTICATION } from '@config/index'
import { ContainerTypes, createValidator, ValidatedRequest, ValidatedRequestSchema } from 'express-joi-validation'
import { emailResetSchema, EmailResetSchema } from '@/validation'
import { asyncWrapper, getUserByEmail} from '@/helpers'
import { gqlSdk } from '@/utils/gqlSDK'

async function directChange(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if(AUTHENTICATION.VERIFY_EMAILS) {
    return res.boom.notImplemented(`Please set the VERIFY_EMAILS env variable to false to use the auth/change-email route`)
  }

  const userId = req.permissionVariables?.['user-id']

  const newEmail = req.body.newEmail

  if(await getUserByEmail(newEmail)) {
    return res.boom.badRequest('Cannot use this email')
  }

  // * Email verification is not activated - change email straight away
  await gqlSdk.updateUser({
    id: userId,
    user: {
      email: newEmail,
    }
  })

  req.logger.verbose(`User id ${userId} directly changed his email to ${newEmail}`, {
    userId,
    newEmail
  })

  return res.status(204).send()
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Body]: EmailResetSchema
}

export default (router: Router) => {
  router.post('/', createValidator().body(emailResetSchema), asyncWrapper(directChange))
}
