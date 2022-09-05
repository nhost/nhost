import './address'
import './customer'
import './payment-method'

import { builder } from '../builder'

const schema = builder.toSchema()

export { schema }
