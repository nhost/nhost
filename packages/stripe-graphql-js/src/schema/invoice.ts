import { builder } from '../builder'
import { StripePaymentMethod, StripeSubscription } from '../types'
import { stripe } from '../utils'

builder.objectType('StripeInvoice', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    accountCountry: t.exposeString('account_country', {
      nullable: true
    }),
    accountName: t.exposeString('account_name', {
      nullable: true
    }),
    // accountTaxIds: t.expose('account_tax_ids', {
    //   type: 'StripeInvoceAccountTaxIds',
    //   nullable: true
    // }),
    amountDue: t.exposeInt('amount_due'),
    amountPaid: t.exposeInt('amount_paid'),
    amountRemaining: t.exposeInt('amount_remaining'),
    // todo: application
    applicationFeeAmount: t.exposeInt('application_fee_amount', {
      nullable: true
    }),
    attemptCount: t.exposeInt('attempt_count'),
    attempted: t.exposeBoolean('attempted'),
    autoAdvance: t.exposeBoolean('auto_advance', {
      nullable: true
    }),
    automaticTax: t.expose('automatic_tax', {
      type: 'StripeInvoiceAutomaticTax'
    }),
    billingReason: t.exposeString('billing_reason', {
      nullable: true
    }),
    // todo: charge
    collectionMethod: t.exposeString('collection_method', {
      nullable: true
    }),
    created: t.exposeInt('created'),
    currency: t.exposeString('currency'),
    // customFields: t.expose('custom_fields', {
    //   type: 'StripeInvoiceCustomField',
    //   list: true,
    //   nullable: true
    // }),
    customer: t.exposeString('customer'),
    customerAddress: t.expose('customer_address', {
      type: 'StripeAddress',
      nullable: true
    }),
    customerEmail: t.exposeString('customer_email', {
      nullable: true
    }),
    customerName: t.exposeString('customer_name', {
      nullable: true
    }),
    customerPhone: t.exposeString('customer_phone', {
      nullable: true
    }),
    customerShipping: t.expose('customer_shipping', {
      type: 'StripeInvoiceCustomerShipping',
      nullable: true
    }),
    customerTaxExempt: t.exposeString('customer_tax_exempt', {
      nullable: true
    }),
    customerTaxIds: t.expose('customer_tax_ids', {
      type: ['StripeInvoiceCustomerTaxId'],
      nullable: true
    }),
    defaultPaymentMethod: t.field({
      type: 'StripePaymentMethod',
      nullable: true,
      resolve: async (invoice) => {
        const { default_payment_method } = invoice

        if (!default_payment_method) {
          return null
        }

        const paymentMethod = await stripe.paymentMethods.retrieve(default_payment_method as string)

        return paymentMethod as StripePaymentMethod
      }
    }),
    // todo: default source
    // defaultTaxRates: t.exposeString('default_tax_rates', {
    //   list: true
    // }),
    // skipping: deleted
    description: t.exposeString('description', {
      nullable: true
    }),
    // todo: discount
    // todo: discounts
    dueDate: t.exposeInt('due_date', {
      nullable: true
    }),
    endingBalance: t.exposeInt('ending_balance', {
      nullable: true
    }),
    footer: t.exposeString('footer', {
      nullable: true
    }),
    hostedInvoiceUrl: t.exposeString('hosted_invoice_url', {
      nullable: true
    }),
    invoicePdf: t.exposeString('invoice_pdf', {
      nullable: true
    }),
    // todo: last finalization error
    // todo: lines
    livemode: t.exposeBoolean('livemode'),
    metadata: t.expose('metadata', {
      type: 'JSON'
    }),
    nextPaymentAttempt: t.exposeInt('next_payment_attempt', {
      nullable: true
    }),
    number: t.exposeString('number', {
      nullable: true
    }),
    // todo: on behalf of
    paid: t.exposeBoolean('paid'),
    paidOutOfBand: t.exposeBoolean('paid_out_of_band'),
    // todo: payment intent
    // todo: payment settings
    periodEnd: t.exposeInt('period_end'),
    periodStart: t.exposeInt('period_start'),
    postPaymentCreditNotesAmount: t.exposeInt('post_payment_credit_notes_amount'),
    prePaymentCreditNotesAmount: t.exposeInt('pre_payment_credit_notes_amount'),
    // todo: quote
    receiptNumber: t.exposeString('receipt_number', {
      nullable: true
    }),
    renderingOptions: t.expose('rendering_options', {
      type: 'StripeInvoiceRenderingOptions',
      description: 'Options for invoice PDF rendering.',
      nullable: true
    }),
    startingBalance: t.exposeInt('starting_balance'),
    statementDescriptor: t.exposeString('statement_descriptor', {
      nullable: true
    }),
    status: t.exposeString('status', {
      description:
        'The status of the invoice, one of `draft`, `open`, `paid`, `uncollectible`, or `void`. [Learn more](https://stripe.com/docs/billing/invoices/workflow#workflow-overview)',
      nullable: true
    }),
    // todo: status transitions
    statusTransition: t.expose('status_transitions', {
      type: 'StripeInvoiceStatusTransitions',
      nullable: true
    }),
    subscription: t.field({
      type: 'StripeSubscription',
      nullable: true,
      resolve: async (invoice) => {
        const { subscription } = invoice

        if (!subscription) {
          return null
        }

        const subscriptionData = await stripe.subscriptions.retrieve(subscription as string)

        return subscriptionData as StripeSubscription
      }
    }),
    subscriptionProrationDate: t.exposeInt('subscription_proration_date', {
      nullable: true
    }),
    subtotal: t.exposeInt('subtotal'),
    subtotalExcludingTax: t.exposeInt('subtotal_excluding_tax', {
      nullable: true
    }),
    tax: t.exposeInt('tax', {
      nullable: true
    }),
    // todo: test clock
    // todo: threshold reason
    total: t.exposeInt('total'),
    // todo: total discount amounts
    totalExcludingTax: t.exposeInt('total_excluding_tax', {
      nullable: true
    }),
    // todo: total tax amounts
    // todo: transfer data
    webhooksDeliveredAt: t.exposeInt('webhooks_delivered_at', {
      nullable: true
    })
  })
})
