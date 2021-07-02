import { Response, Router, Request } from 'express'
import { asyncWrapper } from '@/helpers'
import { gqlSdk } from '@/utils/gqlSDK'

async function revokeToken(req: Request, res: Response): Promise<unknown> {
  if (!req.permissionVariables) {
    return res.boom.unauthorized('Not logged in')
  }

  const { 'user-id': userId } = req.permissionVariables

  await gqlSdk.deleteUserRefreshTokens({
    userId
  })

  return res.status(204).send()
}

export default (router: Router) => {
  router.post('/revoke', asyncWrapper(revokeToken))
}
