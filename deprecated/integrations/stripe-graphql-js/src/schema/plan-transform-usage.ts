import { builder } from '../builder'

builder.objectType('StripePlanTransformUsage', {
  description: '',
  fields: (t) => ({
    divideBy: t.exposeInt('divide_by', {
      description: 'Divide usage by this number.'
    }),
    round: t.exposeString('round', {
      description: 'After division, either round the result `up` or `down`.'
    })
  })
})
