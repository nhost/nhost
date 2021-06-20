import { Response, Router } from 'express'

import { asyncWrapper } from 'src/helpers'
import { deleteAccountByUserId } from 'src/queries'
import { request } from 'src/request'
import { DeleteAccountData, RequestExtended } from 'src/types'
import { AUTHENTICATION } from '@config/index'

async function deleteUser(req: RequestExtended, res: Response): Promise<unknown> {
  if(!AUTHENTICATION.ALLOW_USER_SELF_DELETE) {
    return res.boom.badImplementation(`Please set the ALLOW_USER_SELF_DELETE env variable to true to use the auth/delete route.`)
  }

  if (!req.permission_variables) {
    return res.boom.unauthorized('Unable to delete account')
  }

  const { 'user-id': user_id } = req.permission_variables

  const hasuraData = await request<DeleteAccountData>(deleteAccountByUserId, { user_id })

  if (!hasuraData.delete_auth_accounts.affected_rows) {
    return res.boom.unauthorized('Unable to delete account')
  }

  return res.status(204).send()
}

export default (router: Router) => {
  router.post('/delete', asyncWrapper(deleteUser))
}
