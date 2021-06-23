import { Request, Response, Router } from 'express'

import { getJwkStore } from '@/jwt'
import { JSONWebKeySet } from 'jose'
import { asyncWrapper } from '@/helpers'

const getJwks = async (_req: Request, res: Response) => {
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
