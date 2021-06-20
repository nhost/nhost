import { MFA } from '@config/index'
import { Router } from 'express'
import disableMfa from './disable'
import enableMfa from './enable'
import generateMfa from './generate'
import totpLogin from './totp'

const router = Router()

router.use((req, res, next) => {
  if(!MFA.ENABLED) {
    return res.boom.badImplementation(`Please set the MFA_ENABLED env variable to true to use the auth/mfa routes.`)
  } else {
    return next()
  }
})


disableMfa(router)
enableMfa(router)
generateMfa(router)
totpLogin(router)

export default (parentRouter: Router) => {
  parentRouter.use('/mfa', router)
}
