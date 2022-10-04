import Stripe from 'stripe';
import { builder } from '../builder'
import { stripe } from '../utils'
import { StripeInvoice } from '../types';

builder.objectType('StripePaymentIntent', {
  description: 'Payment intents',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    amount: t.exposeInt('amount'),
    currency: t.exposeString('currency'),
    description: t.exposeString('description',{
        nullable: true
    }),
    metadata: t.expose('metadata', {
        type: 'JSON',
        nullable: true
    }),
    payment_method_types: t.exposeStringList('payment_method_types'),
    statement_descriptor: t.exposeString('statement_descriptor', {
        nullable: true
    }),
    statement_descriptor_suffix: t.exposeString('statement_descriptor_suffix',{
        nullable: true
    }),
    receipt_email: t.exposeString('receipt_email', {
        nullable: true
    }),
    customer: t.exposeString('customer'),
    amount_capturable: t.exposeInt('amount_capturable'),
    amount_details: t.expose('amount_details', {
        nullable: true,
        type: 'JSON'
    }),
    amount_received: t.exposeInt('amount_received'),

    application_fee_amount: t.exposeInt('application_fee_amount', {
        nullable:true
    }),
    canceled_at: t.exposeInt('canceled_at', {
        nullable: true
    }),
    transfer_group: t.exposeString('transfer_group',{ 
      nullable:true
    }),
    cancellation_reason: t.exposeString('cancellation_reason', {
        nullable:true
    }),
    created: t.exposeInt('created', {
        nullable: true, 
    }),
    status: t.exposeString('status'),
    invoice: t.field({
      type: 'StripeInvoice',
      nullable: true,
      resolve: async (paymentIntent) => {
        const {invoice} = paymentIntent

        if(!invoice) {
            return null
        }

        const invoiceData  = await stripe.invoices.retrieve(invoice as string) 

        return invoiceData as Stripe.Response<StripeInvoice>
      }
    }),
    // todo: missing fields
    // capture_method
    // add charges
    // application
  })
})
