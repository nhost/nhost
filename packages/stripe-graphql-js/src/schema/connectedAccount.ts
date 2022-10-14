import { builder } from '../builder'

builder.objectType('StripeConnectedAccount', {
  description: 'Stripe charge object',
  fields: (t) => ({
    id: t.exposeString('id'),
    object: t.exposeString('object'),
    country: t.exposeString('country', { nullable: true }),
    businessType: t.exposeString('business_type', { nullable: true }),
    capabilities: t.expose('capabilities', { type: 'JSON' }),
    company: t.expose('company', { type: 'JSON' }),
    email: t.exposeString('email', { nullable: true }),
    individual: t.expose('individual', { type: 'JSON' }),
    metadata: t.expose('metadata', { type: 'JSON' }),
    requirements: t.expose('requirements', { type: 'JSON' }),
    tosAcceptance: t.expose('tos_acceptance', { type: 'JSON' }),
    businessProfile: t.expose('business_profile', { type: 'JSON' }),
    chargesEnabled: t.exposeBoolean('charges_enabled'),
    controller: t.expose('controller', { nullable: true, type: 'JSON' }),
    created: t.exposeInt('created', { nullable: true }),
    defaultCurrency: t.exposeString('default_currency', { nullable: true }),
    detailsSubmitted: t.exposeBoolean('details_submitted'),
    externalAccounts: t.expose('external_accounts', { type: 'JSON' }),
    futureRequirements: t.expose('future_requirements', { type: 'JSON' }),
    payoutsEnabled: t.exposeBoolean('payouts_enabled'),
    settings: t.expose('settings', { type: 'JSON' })
  })
})
