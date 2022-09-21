import { builder } from '../builder'

builder.objectType('StripeTaxRate', {
  description:
    'Tax rates can be applied to [invoices](https://stripe.com/docs/billing/invoices/tax-rates), [subscriptions](https://stripe.com/docs/billing/subscriptions/taxes) and [Checkout Sessions](https://stripe.com/docs/payments/checkout/set-up-a-subscription#tax-rates) to collect tax.',
  fields: (t) => ({
    id: t.exposeString('id', {
      description: 'Unique identifier for the object.'
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value.`
    }),
    active: t.exposeBoolean('active', {
      description:
        'Defaults to `true`. When set to `false`, this tax rate cannot be used with new applications or Checkout Sessions, but will still work for subscriptions and invoices that already have it set.'
    }),
    country: t.exposeString('country', {
      description:
        'Two-letter country code ([ISO 3166-1 alpha-2](https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2)).',
      nullable: true
    }),
    created: t.exposeInt('created', {
      description: 'Time at which the object was created. Measured in seconds since the Unix epoch.'
    }),
    description: t.exposeString('description', {
      description:
        'An arbitrary string attached to the tax rate for your internal use only. It will not be visible to your customers.',
      nullable: true
    }),
    displayName: t.exposeString('display_name', {
      description:
        'The display name of the tax rates as it will appear to your customer on their receipt email, PDF, and the hosted invoice page.'
    }),
    inclusive: t.exposeBoolean('inclusive', {
      description: 'This specifies if the tax rate is inclusive or exclusive.'
    }),
    jurisdiction: t.exposeString('jurisdiction', {
      description:
        'The jurisdiction for the tax rate. You can use this label field for tax reporting purposes. It also appears on your customer’s invoice.',
      nullable: true
    }),
    livemode: t.exposeBoolean('livemode', {
      description:
        'Has the value `true` if the object exists in live mode or the value `false` if the object exists in test mode.'
    }),
    metadata: t.expose('metadata', {
      description:
        'Set of [key-value pairs](https://stripe.com/docs/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.',
      type: 'JSON',
      nullable: true
    }),
    percentage: t.exposeFloat('percentage', {
      description: 'This represents the tax rate percent out of 100.'
    }),
    state: t.exposeString('state', {
      description:
        '[ISO 3166-2 subdivision code](https://en.wikipedia.org/wiki/ISO_3166-2:US), without country prefix. For example, "NY" for New York, United States.',
      nullable: true
    }),
    taxType: t.exposeString('tax_type', {
      description: 'The high-level tax type, such as `vat` or `sales_tax`.',
      nullable: true
    })
  })
})
