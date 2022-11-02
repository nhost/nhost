import { builder } from '../builder'

builder.objectType('StripeTestClock', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id', {
      description: `Unique identifier for the object.`
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value.`
    }),
    created: t.exposeInt('created', {
      description: `Time at which the object was created. Measured in seconds since the Unix epoch.`
    }),
    deletesAfter: t.exposeInt('deletes_after', {
      description: `Time at which this clock is scheduled to auto delete.`
    }),
    frozenTime: t.exposeInt('frozen_time', {
      description: `Time at which all objects belonging to this clock are frozen.`
    }),
    livemode: t.exposeBoolean('livemode', {
      description: `Has the value \`true\` if the object exists in live mode or the value \`false\` if the object exists in test mode.`
    }),
    name: t.exposeString('name', {
      description: `The custom name supplied at creation.`,
      nullable: true
    }),
    status: t.exposeString('status', {
      description: `The status of the Test Clock.`
    })
  })
})
