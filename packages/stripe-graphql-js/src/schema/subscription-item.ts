import { builder } from '../builder'

builder.objectType('StripeSubscriptionItem', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id', {
      description: `Unique identifier for the object.`
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value.`
    }),
    billingThresholds: t.expose('billing_thresholds', {
      description: `Define thresholds at which an invoice will be sent, and the related subscription advanced to a new billing period`,
      type: 'StripeSubscriptionItemBillingThresholds',
      nullable: true
    }),
    created: t.exposeInt('created', {
      description: `Time at which the object was created. Measured in seconds since the Unix epoch.`
    }),
    metadata: t.expose('metadata', {
      description: `Set of [key-value pairs](https://stripe.com/docs/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.`,
      type: 'JSON'
    }),
    plan: t.expose('plan', {
      description: `You can now model subscriptions more flexibly using the [Prices API](https://stripe.com/docs/api#prices). It replaces the Plans API and is backwards compatible to simplify your migration.\n\nPlans define the base price, currency, and billing cycle for recurring purchases of products.\n\n[Products](https://stripe.com/docs/api#products) help you track inventory or provisioning, and plans help you track pricing. Different physical goods or levels of service should be represented by products, and pricing options should be represented by plans. This approach lets you change prices without having to change your provisioning scheme.\n\nFor example, you might have a single "gold" product that has plans for $10/month, $100/year, €9/month, and €90/year.\n\nRelated guides: [Set up a subscription](https://stripe.com/docs/billing/subscriptions/set-up-subscription) and more about [products and prices](https://stripe.com/docs/products-prices/overview).`,
      type: 'StripePlan'
    }),
    price: t.expose('price', {
      description: `Prices define the unit cost, currency, and (optional) billing cycle for both recurring and one-time purchases of products.\n\n[Products](https://stripe.com/docs/api#products) help you track inventory or provisioning, and prices help you track payment terms. Different physical goods or levels of service should be represented by products, and pricing options should be represented by prices. This approach lets you change prices without having to change your provisioning scheme.\n\nFor example, you might have a single "gold" product that has prices for $10/month, $100/year, and €9 once.\n\nRelated guides: [Set up a subscription](https://stripe.com/docs/billing/subscriptions/set-up-subscription), [create an invoice](https://stripe.com/docs/billing/invoices/create), and more about [products and prices](https://stripe.com/docs/products-prices/overview).`,
      type: 'StripePrice'
    }),
    quantity: t.exposeInt('quantity', {
      description: `The [quantity](https://stripe.com/docs/subscriptions/quantities) of the plan to which the customer should be subscribed.`,
      nullable: true
    }),
    subscription: t.exposeString('subscription', {
      description: `The \`subscription\` this \`subscription_item\` belongs to.`
    })
    // todo:
    // taxRates: t.exposeStringList('tax_rates', {
    //   nullable: true
    // })
  })
})
