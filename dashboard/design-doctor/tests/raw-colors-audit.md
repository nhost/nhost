`pnpm design-doctor --json`, 647 `no-raw-colors` findings after seeding. Sample: walk the findings in report order with seed 40621, update `seed = (1664525 * seed + 1013904223) >>> 0`, select `seed % count`, advancing an index modulo `count` when it has already been selected. All paths are relative to `dashboard/`. Each source line was checked; **TP** means an actual raw palette/white/black class utility or literal SVG paint (not a declared v3 token).

| # | File:line | Subject | Verdict |
| --- | --- | --- | --- |
| 1 | `src/features/orgs/projects/logs/components/LogsBody/serviceStyle.ts:60` | `dark:bg-purple-500/20` | TP |
| 2 | `src/features/orgs/projects/events/cron-triggers/components/CronTriggerView/sections/CronTriggerOverview.tsx:195` | `text-gray-600` | TP |
| 3 | `src/features/orgs/projects/remote-schemas/components/EditRemoteSchemaPermissionsForm/RemoteSchemaRolePermissionsEditorForm.tsx:772` | `text-gray-500` | TP |
| 4 | `src/features/orgs/projects/custom-domains/settings/components/VerifyDomain/VerifyDomain.tsx:81` | `dark:text-green-400` | TP |
| 5 | `src/features/orgs/projects/serverless-functions/components/OverviewTab/OverviewTab.tsx:114` | `dark:text-gray-400` | TP |
| 6 | `src/features/orgs/projects/events/event-triggers/components/EventTriggerView/sections/EventTriggerOverview.tsx:138` | `dark:border-gray-700` | TP |
| 7 | `src/features/orgs/projects/events/cron-triggers/components/CronTriggerView/sections/CronTriggerOverview.tsx:120` | `text-gray-600` | TP |
| 8 | `src/features/orgs/projects/events/cron-triggers/components/CronTriggerView/sections/CronTriggerOverview.tsx:152` | `dark:text-gray-400` | TP |
| 9 | `src/features/orgs/projects/common/components/LogsRegexFilter/LogsRegexFilter.tsx:28` | `text-blue-500` | TP |
| 10 | `src/features/orgs/projects/remote-schemas/components/EditRemoteSchemaPermissionsForm/PresetValueInput.tsx:47` | `text-gray-600` | TP |
| 11 | `src/features/orgs/utils/execPromiseWithErrorToast/BaseErrorToast.tsx:72` | `text-white` | TP |
| 12 | `src/features/orgs/projects/events/common/components/HttpStatusText/HttpStatusText.tsx:16` | `dark:text-green-400` | TP |
| 13 | `src/features/orgs/projects/events/cron-triggers/components/CronTriggerView/sections/CronTriggerOverview.tsx:109` | `text-gray-900` | TP |
| 14 | `src/features/orgs/projects/graphql/actions/components/BaseActionForm/BaseActionForm.tsx:283` | `bg-amber-500/10` | TP |
| 15 | `src/components/presentational/StatusCircle/StatusCircle.tsx:34` | `bg-yellow-500` | TP |
| 16 | `src/features/orgs/projects/events/cron-triggers/components/CronTriggerView/sections/CronTriggerOverview.tsx:104` | `text-gray-600` | TP |
| 17 | `src/features/orgs/projects/overview/components/ProjectHealthBadge/ProjectHealthBadge.tsx:9` | `bg-emerald-600` | TP |
| 18 | `src/features/orgs/projects/graphql/actions/components/DeleteActionRelationshipDialog/DeleteActionRelationshipDialog.tsx:78` | `text-white` | TP |
| 19 | `src/components/form/FormInput/FormInput.tsx:35` | `aria-[invalid=true]:focus:border-red-500` | TP |
| 20 | `src/pages/index.tsx:67` | `text-amber-500` | TP |
| 21 | `src/features/orgs/projects/events/common/components/ScheduledEventStatusCell/ScheduledEventStatusCell.tsx:34` | `dark:text-rose-400` | TP |
| 22 | `src/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell/FilePreviewDialog.tsx:98` | `text-gray-600` | TP |
| 23 | `src/components/common/CookieConsent/CookieConsent.tsx:58` | `text-white` | TP |
| 24 | `src/features/orgs/projects/deployments/components/DeploymentDetails/DeploymentDetails.tsx:301` | `text-white/40` | TP |
| 25 | `src/features/account/settings/components/PATSettings/PATSettings.tsx:139` | `text-amber-600` | TP |
| 26 | `src/features/orgs/projects/events/cron-triggers/components/CronTriggerView/sections/CronTriggerOverview.tsx:59` | `dark:text-gray-400` | TP |
| 27 | `src/features/orgs/projects/deployments/components/DeploymentDetails/DeploymentDetails.tsx:406` | `text-white` | TP |
| 28 | `src/features/orgs/projects/storage/dataGrid/components/DataGridPreviewCell/icons.tsx:20` | `fill=#9C73DF` | TP |
| 29 | `src/components/form/FormCombobox/FormCombobox.tsx:20` | `aria-[invalid=true]:focus:ring-red-500` | TP |
| 30 | `src/features/orgs/projects/events/cron-triggers/components/CronTriggerView/sections/CronTriggerOverview.tsx:209` | `dark:text-gray-100` | TP |

False positives: **0/30 (0%)**, below the 5% threshold.
