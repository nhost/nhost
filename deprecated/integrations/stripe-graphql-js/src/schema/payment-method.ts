import { builder } from '../builder'

builder.objectType('StripePaymentMethod', {
  fields: (t) => ({
    id: t.exposeString('id', {
      description: `Unique identifier for the object.`
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value.`
    }),
    billingDetails: t.expose('billing_details', {
      type: 'StripePaymentMethodBillingDetails',
      nullable: true
    }),
    card: t.expose('card', {
      type: 'StripePaymentMethodCard',
      nullable: true
    }),
    created: t.exposeInt('created', {
      description: `The ID of the Customer to which this PaymentMethod is saved. This will not be set when the PaymentMethod has not been saved to a Customer.`,
    }),
    customer: t.exposeString('customer', {
      nullable: true
    }),
    livemode: t.exposeBoolean('livemode', {
      description: `Has the value \`true\` if the object exists in live mode or the value \`false\` if the object exists in test mode.`
    }),
    metadata: t.expose('metadata', {
      description: `Set of [key-value pairs](https://stripe.com/docs/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.`,
      type: 'JSON'
    }),
    type: t.expose('type', { 
      description: `The type of the PaymentMethod. An additional hash is included on the PaymentMethod with a name matching this value. It contains additional information specific to the PaymentMethod type.`,
      type: 'StripePaymentMethodTypes' 
    })
  })
})
