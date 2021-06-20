import { Router } from 'express'

import lost from './lost'
import change from './change'
import reset from './reset'

const router = Router()

change(router)
lost(router)
reset(router)

export default (parentRouter: Router) => {
  parentRouter.use('/change-password', router)
}
