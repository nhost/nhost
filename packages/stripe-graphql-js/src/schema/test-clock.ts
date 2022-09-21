import { builder } from '../builder'

builder.objectType('StripeTestClock', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    created: t.exposeInt('created'),
    deletesAfter: t.exposeInt('deletes_after'),
    frozenTime: t.exposeInt('frozen_time'),
    livemode: t.exposeBoolean('livemode'),
    name: t.exposeString('name', {
      nullable: true
    }),
    status: t.exposeString('status')
  })
})
