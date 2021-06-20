import { APPLICATION, REGISTRATION } from '@config/index'
import { Response, Router } from 'express'

import { activateAccount, setNewTicket } from 'src/queries'
import { asyncWrapper, deanonymizeAccount, selectAccountByTicket } from 'src/helpers'
import { request } from 'src/request'
import { v4 as uuidv4 } from 'uuid'
import { VerifySchema, verifySchema } from 'src/validation'
import { AccountData, UpdateAccountData } from 'src/types'
import { ValidatedRequestSchema, ContainerTypes, createValidator, ValidatedRequest } from 'express-joi-validation'

async function activateUser({ query }: ValidatedRequest<Schema>, res: Response): Promise<unknown> {
  if (REGISTRATION.AUTO_ACTIVATE_NEW_USERS) {
    return res.boom.badImplementation(`Please set the AUTO_ACTIVATE_NEW_USERS env variable to false to use the auth/activate route.`)
  }

  let account: AccountData
  try {
    account = await selectAccountByTicket(query.ticket)
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
  } else {
    try {
      await request<UpdateAccountData>(activateAccount, {
        ticket: query.ticket,
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

  if(APPLICATION.REDIRECT_URL_SUCCESS) {
    res.redirect(APPLICATION.REDIRECT_URL_SUCCESS.replace('JWT_TOKEN', query.ticket))
  } else
    res.status(200).send('Your account has been activated. You can close this window and login')
}

interface Schema extends ValidatedRequestSchema {
  [ContainerTypes.Query]: VerifySchema
}

export default (router: Router) => {
  router.get('/activate', createValidator().query(verifySchema), asyncWrapper(activateUser))
}
