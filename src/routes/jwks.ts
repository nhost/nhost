import { Response, Router } from 'express'

import { getJwkStore } from 'src/jwt'
import { RequestExtended } from 'src/types'
import { JSONWebKeySet } from 'jose'
import { asyncWrapper } from 'src/helpers'

const getJwks = async (_req: RequestExtended, res: Response) => {
  let jwks: JSONWebKeySet;
  try {
    jwks = getJwkStore().toJWKS(false)
  } catch (err) {
    return res.boom.notImplemented(err.message)
  }

  return res.send(jwks)
}

export default (router: Router) => {
  router.get('/jwks', asyncWrapper(getJwks))
}
