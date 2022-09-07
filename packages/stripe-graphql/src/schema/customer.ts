import Stripe from 'stripe'

import { builder } from '../builder'
import { StripePaymentMethod } from '../types'

import { StripePaymentMethodTypes } from './payment-methods'

builder.objectType('StripeCustomer', {
  description:
    'This object represents a customer of your business. It lets you create recurring charges and track payments that belong to the same customer.',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    balance: t.exposeInt('balance'),
    name: t.exposeString('name', {
      nullable: true
    }),
    address: t.expose('address', {
      type: 'StripeAddress',
      nullable: true
    }),
    paymentMethods: t.field({
      type: 'StripePaymentMethods',
      args: {
        type: t.arg({
          type: StripePaymentMethodTypes,
          required: true,
          defaultValue: 'card'
        }),
        startingAfter: t.arg.string({
          required: false
        }),
        endingBefore: t.arg.string({
          required: false
        }),
        limit: t.arg.int({
          required: false
        })
      },
      nullable: false,
      resolve: async (customer, { type, startingAfter, endingBefore, limit }, { stripe }) => {
        const paymentMethods = (await stripe.customers.listPaymentMethods(customer.id, {
          type,
          starting_after: startingAfter || undefined,
          ending_before: endingBefore || undefined,
          limit: limit || undefined
        })) as Stripe.Response<Stripe.ApiList<StripePaymentMethod>>

        return paymentMethods
      }
    }),
    subscriptions: t.field({
      type: 'StripeSubscriptions',
      args: {
        startingAfter: t.arg.string({
          required: false
        })
      },
      resolve: async (customer, { startingAfter }, { stripe }) => {
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          starting_after: startingAfter || undefined
        })

        return subscriptions
      }
    })
  })
})
