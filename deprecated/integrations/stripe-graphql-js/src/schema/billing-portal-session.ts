import { builder } from '../builder'

builder.objectType('StripeBillingPortalSession', {
  description: '',
  fields: (t) => ({
    id: t.exposeString('id', {
      description: `Unique identifier for the object.`
    }),
    object: t.exposeString('object', {
      description: `String representing the object's type. Objects of the same type share the same value.`
    }),
    // todo: configuration
    created: t.exposeInt('created', {
      description: `Time at which the object was created. Measured in seconds since the Unix epoch.`
    }),
    // todo: customer
    livemode: t.exposeBoolean('livemode', {
      description: `Has the value \`true\` if the object exists in live mode or the value \`false\` if the object exists in test mode.`
    }),
    locale: t.exposeString('locale', {
      description: `The IETF language tag of the locale Customer Portal is displayed in. If blank or auto, the customer's \`preferred_locales\` or browser's locale is used.`,
      nullable: true
    }),
    // todo: on behalf of
    returnUrl: t.exposeString('return_url', {
      description: `The URL to redirect customers to when they click on the portal's link to return to your website.`,
      nullable: true
    }),
    url: t.exposeString('url', {
      description: `The short-lived URL of the session that gives customers access to the customer portal.`
    })
  })
})
