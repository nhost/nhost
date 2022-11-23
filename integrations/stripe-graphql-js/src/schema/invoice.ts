import { builder } from '../builder'
import { StripePaymentMethod, StripeSubscription } from '../types'
import { stripe } from '../utils'

builder.objectType('StripeInvoice', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id', {
      description: `Unique identifier for the object.`
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value.`
    }),
    accountCountry: t.exposeString('account_country', {
      description: `The country of the business associated with this invoice, most often the business creating the invoice.`,
      nullable: true
    }),
    accountName: t.exposeString('account_name', {
      description: `The public name of the business associated with this invoice, most often the business creating the invoice.`,
      nullable: true
    }),
    // accountTaxIds: t.expose('account_tax_ids', {
    //   type: 'StripeInvoceAccountTaxIds',
    //   nullable: true
    // }),
    amountDue: t.exposeInt('amount_due', {
      description: `Final amount due at this time for this invoice. If the invoice's total is smaller than the minimum charge amount, for example, or if there is account credit that can be applied to the invoice, the \`amount_due\` may be 0. If there is a positive \`starting_balance\` for the invoice (the customer owes money), the \`amount_due\` will also take that into account. The charge that gets generated for the invoice will be for the amount specified in \`amount_due\`.`
    }),
    amountPaid: t.exposeInt('amount_paid', {
      description: `The amount, in %s, that was paid.`
    }),
    amountRemaining: t.exposeInt('amount_remaining', {
      description: `The difference between amount_due and amount_paid, in %s.`
    }),
    application: t.field({
      type: 'StripeConnectedAccount',
      nullable: true,
      resolve: async (invoice) => {
        const { application } = invoice
        if (!application) return null

        const connectedAccount = await stripe.accounts.retrieve(application as string)

        return connectedAccount
      }
    }),
    applicationFeeAmount: t.exposeInt('application_fee_amount', {
      description: `The fee in %s that will be applied to the invoice and transferred to the application owner's Stripe account when the invoice is paid.`,
      nullable: true
    }),
    attemptCount: t.exposeInt('attempt_count', {
      description: `Number of payment attempts made for this invoice, from the perspective of the payment retry schedule. Any payment attempt counts as the first attempt, and subsequently only automatic retries increment the attempt count. In other words, manual payment attempts after the first attempt do not affect the retry schedule.`
    }),
    attempted: t.exposeBoolean('attempted', {
      description: `Whether an attempt has been made to pay the invoice. An invoice is not attempted until 1 hour after the \`invoice.created\` webhook, for example, so you might not want to display that invoice as unpaid to your users.`
    }),
    autoAdvance: t.exposeBoolean('auto_advance', {
      description: `Controls whether Stripe will perform [automatic collection](https://stripe.com/docs/billing/invoices/workflow/#auto_advance) of the invoice. When \`false\`, the invoice's state will not automatically advance without an explicit action.`,
      nullable: true
    }),
    automaticTax: t.expose('automatic_tax', {
      type: 'StripeInvoiceAutomaticTax'
    }),
    billingReason: t.exposeString('billing_reason', {
      description: `Indicates the reason why the invoice was created. \`subscription_cycle\` indicates an invoice created by a subscription advancing into a new period. \`subscription_create\` indicates an invoice created due to creating a subscription. \`subscription_update\` indicates an invoice created due to updating a subscription. \`subscription\` is set for all old invoices to indicate either a change to a subscription or a period advancement. \`manual\` is set for all invoices unrelated to a subscription (for example: created via the invoice editor). The \`upcoming\` value is reserved for simulated invoices per the upcoming invoice endpoint. \`subscription_threshold\` indicates an invoice created due to a billing threshold being reached.`,
      nullable: true
    }),
    // todo: charge
    collectionMethod: t.exposeString('collection_method', {
      description: `Either \`charge_automatically\`, or \`send_invoice\`. When charging automatically, Stripe will attempt to pay this invoice using the default source attached to the customer. When sending an invoice, Stripe will email this invoice to the customer with payment instructions.`,
      nullable: true
    }),
    created: t.exposeInt('created', {
      description: `Time at which the object was created. Measured in seconds since the Unix epoch.`
    }),
    currency: t.exposeString('currency', {
      description: `Three-letter [ISO currency code](https://www.iso.org/iso-4217-currency-codes.html), in lowercase. Must be a [supported currency](https://stripe.com/docs/currencies).`
    }),
    // customFields: t.expose('custom_fields', {
    //   type: 'StripeInvoiceCustomField',
    //   list: true,
    //   nullable: true
    // }),
    customer: t.exposeString('customer', {
      description: `The ID of the customer who will be billed.`
    }),
    customerAddress: t.expose('customer_address', {
      description: `The customer's address. Until the invoice is finalized, this field will equal \`customer.address\`. Once the invoice is finalized, this field will no longer be updated.`,
      type: 'StripeAddress',
      nullable: true
    }),
    customerEmail: t.exposeString('customer_email', {
      description: `The customer's email. Until the invoice is finalized, this field will equal \`customer.email\`. Once the invoice is finalized, this field will no longer be updated.`,
      nullable: true
    }),
    customerName: t.exposeString('customer_name', {
      description: `The customer's name. Until the invoice is finalized, this field will equal \`customer.name\`. Once the invoice is finalized, this field will no longer be updated.`,
      nullable: true
    }),
    customerPhone: t.exposeString('customer_phone', {
      description: `The customer's phone number. Until the invoice is finalized, this field will equal \`customer.phone\`. Once the invoice is finalized, this field will no longer be updated.`,
      nullable: true
    }),
    customerShipping: t.expose('customer_shipping', {
      description: `The customer's shipping information. Until the invoice is finalized, this field will equal \`customer.shipping\`. Once the invoice is finalized, this field will no longer be updated.`,
      type: 'StripeInvoiceCustomerShipping',
      nullable: true
    }),
    customerTaxExempt: t.exposeString('customer_tax_exempt', {
      description: `The customer's tax exempt status. Until the invoice is finalized, this field will equal \`customer.tax_exempt\`. Once the invoice is finalized, this field will no longer be updated.`,
      nullable: true
    }),
    customerTaxIds: t.expose('customer_tax_ids', {
      description: `The customer's tax IDs. Until the invoice is finalized, this field will contain the same tax IDs as \`customer.tax_ids\`. Once the invoice is finalized, this field will no longer be updated.`,
      type: ['StripeInvoiceCustomerTaxId'],
      nullable: true
    }),
    defaultPaymentMethod: t.field({
      description: `ID of the default payment method for the invoice. It must belong to the customer associated with the invoice. If not set, defaults to the subscription's default payment method, if any, or to the default payment method in the customer's invoice settings.`,
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
      description: `An arbitrary string attached to the object. Often useful for displaying to users. Referenced as 'memo' in the Dashboard.`,
      nullable: true
    }),
    // todo: discount
    // todo: discounts
    dueDate: t.exposeInt('due_date', {
      description: `The date on which payment for this invoice is due. This value will be \`null\` for invoices where \`collection_method=charge_automatically\`.`,
      nullable: true
    }),
    endingBalance: t.exposeInt('ending_balance', {
      description: `Ending customer balance after the invoice is finalized. Invoices are finalized approximately an hour after successful webhook delivery or when payment collection is attempted for the invoice. If the invoice has not been finalized yet, this will be null.`,
      nullable: true
    }),
    footer: t.exposeString('footer', {
      description: `Footer displayed on the invoice.`,
      nullable: true
    }),
    hostedInvoiceUrl: t.exposeString('hosted_invoice_url', {
      description: `The URL for the hosted invoice page, which allows customers to view and pay an invoice. If the invoice has not been finalized yet, this will be null.`,
      nullable: true
    }),
    invoicePdf: t.exposeString('invoice_pdf', {
      description: `The link to download the PDF for the invoice. If the invoice has not been finalized yet, this will be null.`,
      nullable: true
    }),
    // todo: last finalization error
    lines: t.expose('lines', {
      description: `The individual line items that make up the invoice. \`lines\` is sorted as follows: invoice items in reverse chronological order, followed by the subscription, if any.`,
      type: 'StripeInvoiceLineItems'
    }),
    livemode: t.exposeBoolean('livemode', {
      description: `Has the value \`true\` if the object exists in live mode or the value \`false\` if the object exists in test mode.`
    }),
    metadata: t.expose('metadata', {
      description: `Set of [key-value pairs](https://stripe.com/docs/api/metadata) that you can attach to an object. This can be useful for storing additional information about the object in a structured format.`,
      type: 'JSON'
    }),
    nextPaymentAttempt: t.exposeInt('next_payment_attempt', {
      description: `The time at which payment will next be attempted. This value will be \`null\` for invoices where \`collection_method=send_invoice\`.`,
      nullable: true
    }),
    number: t.exposeString('number', {
      description: `A unique, identifying string that appears on emails sent to the customer for this invoice. This starts with the customer's unique invoice_prefix if it is specified.`,
      nullable: true
    }),
    // todo: on behalf of
    paid: t.exposeBoolean('paid', {
      description: `Whether payment was successfully collected for this invoice. An invoice can be paid (most commonly) with a charge or with credit from the customer's account balance.`
    }),
    paidOutOfBand: t.exposeBoolean('paid_out_of_band', {
      description: `Returns true if the invoice was manually marked paid, returns false if the invoice hasn't been paid yet or was paid on Stripe.`
    }),
    // todo: payment intent
    // todo: payment settings
    periodEnd: t.exposeInt('period_end', {
      description: `End of the usage period during which invoice items were added to this invoice.`
    }),
    periodStart: t.exposeInt('period_start', {
      description: `Start of the usage period during which invoice items were added to this invoice.`
    }),
    postPaymentCreditNotesAmount: t.exposeInt('post_payment_credit_notes_amount', {
      description: `Total amount of all post-payment credit notes issued for this invoice.`
    }),
    prePaymentCreditNotesAmount: t.exposeInt('pre_payment_credit_notes_amount', {
      description: `Total amount of all pre-payment credit notes issued for this invoice.`
    }),
    // todo: quote
    receiptNumber: t.exposeString('receipt_number', {
      description: `This is the transaction number that appears on email receipts sent for this invoice.`,
      nullable: true
    }),
    renderingOptions: t.expose('rendering_options', {
      type: 'StripeInvoiceRenderingOptions',
      description: 'Options for invoice PDF rendering.',
      nullable: true
    }),
    startingBalance: t.exposeInt('starting_balance', {
      description: `Starting customer balance before the invoice is finalized. If the invoice has not been finalized yet, this will be the current customer balance. For revision invoices, this also includes any customer balance that was applied to the original invoice.`
    }),
    statementDescriptor: t.exposeString('statement_descriptor', {
      description: `Extra information about an invoice for the customer's credit card statement.`,
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
      description: `The subscription that this invoice was prepared for, if any.`,
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
      description: `Only set for upcoming invoices that preview prorations. The time used to calculate prorations.`,
      nullable: true
    }),
    subtotal: t.exposeInt('subtotal', {
      description: `Total of all subscriptions, invoice items, and prorations on the invoice before any invoice level discount or exclusive tax is applied. Item discounts are already incorporated`
    }),
    subtotalExcludingTax: t.exposeInt('subtotal_excluding_tax', {
      description: `The integer amount in %s representing the subtotal of the invoice before any invoice level discount or tax is applied. Item discounts are already incorporated`,
      nullable: true
    }),
    tax: t.exposeInt('tax', {
      description: `The amount of tax on this invoice. This is the sum of all the tax amounts on this invoice.`,
      nullable: true
    }),
    // todo: test clock
    // todo: threshold reason
    total: t.exposeInt('total', {
      description: `Total after discounts and taxes.`
    }),
    // todo: total discount amounts
    totalExcludingTax: t.exposeInt('total_excluding_tax', {
      description: `The integer amount in %s representing the total amount of the invoice including all discounts but excluding all tax.`,
      nullable: true
    }),
    // todo: total tax amounts
    // todo: transfer data
    webhooksDeliveredAt: t.exposeInt('webhooks_delivered_at', {
      description: `Invoices are automatically paid or sent 1 hour after webhooks are delivered, or until all webhook delivery attempts have [been exhausted](https://stripe.com/docs/billing/webhooks#understand). This field tracks the time when webhooks for this invoice were successfully delivered. If the invoice had no webhooks to deliver, this will be set while the invoice is being created.`,
      nullable: true
    })
  })
})
