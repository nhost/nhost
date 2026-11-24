`pnpm design-doctor --json` before seeding: **21 findings, 11 distinct subjects**. All paths relative to `dashboard/`. This is the complete dead-class inventory; none was fixed or hidden in the baseline. TP means there is no Tailwind v3 generated utility or imported global CSS selector for this subject, and it is not a documented selector hook. `animate-enter` / `animate-leave` are not registered by the installed animation plugin; `schema-diagram-canvas` has no other CSS/JS reference.

| Subject | Count | Example file:line |
| --- | ---: | --- |
| `animate-enter` | 2 | `src/utils/toast/showLoadingToast.tsx:12` |
| `animate-leave` | 2 | `src/utils/toast/showLoadingToast.tsx:12` |
| `backface-hidden` | 2 | `src/components/layout/UnauthenticatedLayout/UnauthenticatedLayout.tsx:85` |
| `bg-codeblock-tabs` | 1 | `src/components/presentational/CodeBlock/CodeBlock.tsx:33` |
| `flex-i` | 1 | `src/features/orgs/projects/common/components/DataGridFiltersPopover/DataGridFilter.tsx:39` |
| `pb-` | 1 | `src/features/orgs/projects/database/dataGrid/components/BaseTableForm/PrimaryKeySelect.tsx:38` |
| `schema-diagram-canvas` | 1 | `src/features/orgs/projects/database/schema-diagram/SchemaDiagram.tsx:639` |
| `span-cols-1` | 1 | `src/features/orgs/projects/authentication/users/components/EditUserForm/EditUserForm.tsx:438` |
| `text-md` | 6 | `src/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog.tsx:181` |
| `w-xl` | 3 | `src/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerForm.tsx:212` |
| `ws-full` | 1 | `src/features/auth/SignIn/SignInWithEmailAndPassword/components/MfaSignInOtpForm.tsx:12` |

The requested fixed-seed 30-draw audit draws from the 21 findings in report order. Starting seed 60621, update `seed = (1664525 * seed + 1013904223) >>> 0` and propose `seed % 21`. If an index has already been used in this cycle, advance it modulo 21 until unused. Once all 21 have been visited, **clear the used-index set and begin a second cycle**; this makes rows 22–30 repeats, not nine additional independent findings. All 21 unique findings were checked in source.

| # | File:line | Subject | Verdict |
| --- | --- | --- | --- |
| 1 | `src/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerForm.tsx:212` | `w-xl` | TP |
| 2 | `src/features/orgs/components/billing/SubscriptionPlan/SubscriptionPlan.tsx:310` | `text-md` | TP |
| 3 | `src/features/orgs/projects/authentication/users/components/EditUserForm/EditUserForm.tsx:438` | `span-cols-1` | TP |
| 4 | `src/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerForm.tsx:267` | `w-xl` | TP |
| 5 | `src/components/layout/UnauthenticatedLayout/UnauthenticatedLayout.tsx:85` | `backface-hidden` | TP |
| 6 | `src/utils/toast/showLoadingToast.tsx:12` | `animate-leave` | TP |
| 7 | `src/features/orgs/projects/events/one-offs/components/CreateOneOffForm/CreateOneOffForm.tsx:49` | `w-xl` | TP |
| 8 | `src/utils/toast/triggerToast.tsx:11` | `animate-leave` | TP |
| 9 | `src/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog.tsx:181` | `text-md` | TP |
| 10 | `src/features/orgs/projects/common/components/DataGridFiltersPopover/DataGridFilter.tsx:39` | `flex-i` | TP |
| 11 | `src/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog.tsx:217` | `text-md` | TP |
| 12 | `src/features/orgs/components/billing/SubscriptionPlan/SubscriptionPlan.tsx:173` | `text-md` | TP |
| 13 | `src/features/auth/SignIn/SignInWithEmailAndPassword/components/MfaSignInOtpForm.tsx:12` | `ws-full` | TP |
| 14 | `src/features/orgs/projects/database/dataGrid/components/BaseTableForm/PrimaryKeySelect.tsx:38` | `pb-` | TP |
| 15 | `src/features/orgs/projects/database/schema-diagram/SchemaDiagram.tsx:639` | `schema-diagram-canvas` | TP |
| 16 | `src/features/orgs/projects/remote-schemas/components/BaseRemoteSchemaRelationshipForm/sections/RelationshipTypeSection.tsx:41` | `text-md` | TP |
| 17 | `src/utils/toast/triggerToast.tsx:11` | `animate-enter` | TP |
| 18 | `src/components/presentational/CodeBlock/CodeBlock.tsx:33` | `bg-codeblock-tabs` | TP |
| 19 | `src/features/orgs/projects/remote-schemas/components/BaseRemoteSchemaRelationshipForm/sections/RelationshipTypeSection.tsx:58` | `text-md` | TP |
| 20 | `src/pages/oauth2/authorize.tsx:123` | `backface-hidden` | TP |
| 21 | `src/utils/toast/showLoadingToast.tsx:12` | `animate-enter` | TP |
| 22 | `src/features/orgs/components/billing/SubscriptionPlan/SubscriptionPlan.tsx:173` | `text-md` | TP |
| 23 | `src/features/orgs/components/billing/SubscriptionPlan/SubscriptionPlan.tsx:310` | `text-md` | TP |
| 24 | `src/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog.tsx:217` | `text-md` | TP |
| 25 | `src/utils/toast/showLoadingToast.tsx:12` | `animate-leave` | TP |
| 26 | `src/features/orgs/projects/database/dataGrid/components/BaseTableForm/PrimaryKeySelect.tsx:38` | `pb-` | TP |
| 27 | `src/features/auth/SignIn/SignInWithEmailAndPassword/components/MfaSignInOtpForm.tsx:12` | `ws-full` | TP |
| 28 | `src/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerForm.tsx:212` | `w-xl` | TP |
| 29 | `src/utils/toast/triggerToast.tsx:11` | `animate-enter` | TP |
| 30 | `src/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog.tsx:181` | `text-md` | TP |

False positives: **0 / 21 unique findings (0 / 30 draws)**.

## Accuracy limit: bases after valid variants

Version 2 checks all variant names in a chain, but does not check the base after valid variants. Three dead bases in dashboard sources remain unreported: `hover:none`, `lg:w-9xl` and `md:w-4xl` (9 uses total). These are not baseline exemptions or valid Tailwind utilities; do not add them to `externalClasses`.
