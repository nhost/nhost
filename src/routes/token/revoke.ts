import { Response, Router, Request } from 'express'
import { deleteAllAccountRefreshTokens } from '@/queries'
import { request } from '@/request'
import { asyncWrapper } from '@/helpers'

async function revokeToken(req: Request, res: Response): Promise<unknown> {
  if (!req.permission_variables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': user_id } = req.permission_variables

  await request(deleteAllAccountRefreshTokens, { user_id })

  return res.status(204).send()
}

export default (router: Router) => {
  router.post('/revoke', asyncWrapper(revokeToken))
}
