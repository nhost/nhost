import { builder } from '../builder'

builder.objectType('StripeSubscriptionPauseCollection', {
  description: '',
  fields: (t) => ({
    behavior: t.exposeString('behavior', {
      description:
        'The payment collection behavior for this subscription while paused. One of `keep_as_draft`, `mark_uncollectible`, or `void`.'
    }),
    resumesAt: t.exposeInt('resumes_at', {
      description: 'The time after which the subscription will resume collecting payments.',
      nullable: true
    })
  })
})
