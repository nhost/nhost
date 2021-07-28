import { Router } from 'express'
import refreshToken from './refresh'
import revokeToken from './revoke'

const router = Router()

refreshToken(router)
revokeToken(router)

export default (parentRouter: Router) => {
  parentRouter.use('/token', router)
}