import { builder } from '../builder'

builder.objectType('StripeSubscriptionItem', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    billingThresholds: t.expose('billing_thresholds', {
      type: 'StripeSubscriptionItemBillingThresholds',
      nullable: true
    }),
    created: t.exposeInt('created'),
    metadata: t.expose('metadata', {
      type: 'JSON'
    }),
    // todo: plan
    // todo: price
    quantity: t.exposeInt('quantity', {
      nullable: true
    }),
    subscription: t.exposeString('subscription')
    // todo:
    // taxRates: t.exposeStringList('tax_rates', {
    //   nullable: true
    // })
  })
})
