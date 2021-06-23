import { APPLICATION, REGISTRATION } from '@config/index'
import { Response, Router } from 'express'

import { activateAccount, setNewTicket } from '@/queries'
import { asyncWrapper, deanonymizeAccount, selectAccountByTicket } from '@/helpers'
import { request } from '@/request'
import { v4 as uuidv4 } from 'uuid'
import { VerifySchema, verifySchema } from '@/validation'
import { AccountData, UpdateAccountData } from '@/types'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

async function activateUser(req: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (REGISTRATION.AUTO_ACTIVATE_NEW_USERS) {
    return res.boom.badImplementation(`Please set the AUTO_ACTIVATE_NEW_USERS env variable to false to use the auth/activate route.`)
  }

  let account: AccountData
  try {
    account = await selectAccountByTicket(req.query.ticket)
  } catch {
    return res.boom.unauthorized('Invalid or expired ticket.')
  }

  const new_ticket = uuidv4()

  if(account.is_anonymous) {
    await deanonymizeAccount(
      account,
    )

    await request(setNewTicket, {
      user_id: account.user.id,
      ticket: new_ticket,
      ticket_expires_at: new Date()
    })

    req.logger.verbose(`User ${account.user.id} deanonymized his account with email ${account.user.email}`, {
      user_id: account.user.id,
      email: account.user.email
    })
  } else {
    try {
      await request<UpdateAccountData>(activateAccount, {
        ticket: req.query.ticket,
        new_ticket,
        now: new Date()
      })
    } catch (err) /* istanbul ignore next */ {
      console.error(err)
      if (APPLICATION.REDIRECT_URL_ERROR) {
        return res.redirect(302, APPLICATION.REDIRECT_URL_ERROR)
      }
      throw err
    }
  }

  req.logger.verbose(`User ${account.user.id} activated his account`, {
    user_id: account.user.id,
  })

  if(APPLICATION.REDIRECT_URL_SUCCESS) {
    res.redirect(APPLICATION.REDIRECT_URL_SUCCESS.replace('JWT_TOKEN', req.query.ticket))
  } else
    res.status(200).send('Your account has been activated. You can close this window and login')
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Query]: VerifySchema
}

export default (router: Router) => {
  router.get('/activate', createValidator().query(verifySchema), asyncWrapper(activateUser))
}
