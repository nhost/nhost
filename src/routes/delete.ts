import { Response, Router } from 'express'

import { asyncWrapper } from '@/helpers'
import { deleteAccountByUserId } from '@/queries'
import { request } from '@/request'
import { DeleteAccountData } from '@/types'
import { AUTHENTICATION } from '@config/index'
import { Request } from 'express'

async function deleteUser(req: Request, res: Response): Promise<unknown> {
  if(!AUTHENTICATION.ALLOW_USER_SELF_DELETE) {
    return res.boom.notImplemented(`Please set the ALLOW_USER_SELF_DELETE env variable to true to use the auth/delete route`)
  }

  if (!req.permission_variables) {
    return res.boom.unauthorized('Unable to delete account')
  }

  const { 'user-id': user_id } = req.permission_variables

  const hasuraData = await request<DeleteAccountData>(deleteAccountByUserId, { user_id })

  if (!hasuraData.delete_auth_accounts.affected_rows) {
    return res.boom.unauthorized('Unable to delete account')
  }

  req.logger.verbose(`User ${user_id} deleted his account`, {
    user_id
  })

  return res.status(204).send()
}

export default (router: Router) => {
  router.post('/delete', asyncWrapper(deleteUser))
}
