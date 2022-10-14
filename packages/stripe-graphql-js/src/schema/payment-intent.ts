import Stripe from 'stripe'

import { builder } from '../builder'
import { StripeInvoice } from '../types'
import { stripe } from '../utils'

builder.objectType('StripePaymentIntent', {
  description: 'Payment intents',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    amount: t.exposeInt('amount'),
    currency: t.exposeString('currency'),
    description: t.exposeString('description', {
      nullable: true
    }),
    metadata: t.expose('metadata', {
      type: 'JSON',
      nullable: true
    }),
    paymentMethodTypes: t.exposeStringList('payment_method_types'),
    statementDescriptor: t.exposeString('statement_descriptor', {
      nullable: true
    }),
    statementDescriptorSuffix: t.exposeString('statement_descriptor_suffix', {
      nullable: true
    }),
    receiptEmail: t.exposeString('receipt_email', {
      nullable: true
    }),
    customer: t.exposeString('customer'),
    amountCapturable: t.exposeInt('amount_capturable'),
    amountDetails: t.expose('amount_details', {
      nullable: true,
      type: 'JSON'
    }),
    amountReceived: t.exposeInt('amount_received'),

    applicationFeeAmount: t.exposeInt('application_fee_amount', {
      nullable: true
    }),
    canceledAt: t.exposeInt('canceled_at', {
      nullable: true
    }),
    transferGroup: t.exposeString('transfer_group', {
      nullable: true
    }),
    cancellationReason: t.exposeString('cancellation_reason', {
      nullable: true
    }),
    created: t.exposeInt('created', {
      nullable: true
    }),
    status: t.exposeString('status'),
    invoice: t.field({
      type: 'StripeInvoice',
      nullable: true,
      resolve: async (paymentIntent) => {
        const { invoice } = paymentIntent

        if (!invoice) {
          return null
        }

        const invoiceData = await stripe.invoices.retrieve(invoice as string)

        return invoiceData as Stripe.Response<StripeInvoice>
      }
    })
    // todo: missing fields
    // capture_method
    // add charges
    // application
  })
})
