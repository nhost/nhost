import './address'
import './customer'
import './payment-methods'
import './payment-method'
import './stripe'
import './subscriptions'
import './subscription'

import { builder } from '../builder'

const schema = builder.toSchema()

export { schema }
