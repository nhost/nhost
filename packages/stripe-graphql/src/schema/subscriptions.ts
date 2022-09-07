import { builder } from '../builder'

builder.objectType('StripeSubscriptions', {
  fields: (t) => ({
    object: t.exposeString('object'),
    url: t.exposeString('url'),
    hasMore: t.exposeBoolean('has_more'),
    data: t.expose('data', {
      type: ['StripeSubscription'],
      nullable: false
    })
  })
})

export const SubscriptionStatus = builder.enumType('StripeSubscriptionStatus', {
  values: {
    ACTIVE: { value: 'active' },
    CANCELED: { value: 'canceled' },
    INCOMPLETE: { value: 'incomplete' },
    INCOMPLETE_EXPIRED: { value: 'incomplete_expired' },
    PAST_DUE: { value: 'past_due' },
    TRIALING: { value: 'trialing' },
    UNPAID: { value: 'unpaid' }
  } as const
})
