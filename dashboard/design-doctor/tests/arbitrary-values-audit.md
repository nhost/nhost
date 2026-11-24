`pnpm design-doctor --json` produced 155 `no-arbitrary-values` findings. Walk report-order findings with seed 40621 (`seed = (1664525 * seed + 1013904223) >>> 0`, select `seed % count`; on a repeated index, take the next unused index (`index + 1`, wrapping modulo `count`) without advancing the generator again). Every sampled source line was inspected. TP means a hardcoded arbitrary **appearance** value, not a layout utility or direct CSS-variable value.

| # | File:line | Subject | Category | Verdict |
| --- | --- | --- | --- | --- |
| 1 | `src/features/orgs/projects/logs/components/LogsBody/columns.tsx:32` | `leading-[0.875rem]` | typography | TP |
| 2 | `src/components/common/DateTimePicker/DateTimePicker.tsx:250` | `text-[11px]` | typography | TP |
| 3 | `src/features/orgs/projects/database/schema-diagram/PermissionDot.tsx:53` | `opacity-[0.35]` | effects | TP |
| 4 | `src/features/auth/SignIn/components/LastUsedBadge/LastUsedBadge.tsx:11` | `text-[10px]` | typography | TP |
| 5 | `src/features/orgs/projects/storage/dataGrid/components/DataGridBooleanCell/DataGridBooleanCell.tsx:109` | `border-[#0052cd]` | color | TP |
| 6 | `src/features/orgs/projects/database/dataGrid/components/FunctionDefinitionView/FunctionDefinitionView.tsx:100` | `text-[12px]` | typography | TP |
| 7 | `src/features/orgs/projects/events/common/components/HeadersTable/HeadersTable.tsx:34` | `py-[0.2rem]` | spacing | TP |
| 8 | `src/features/orgs/projects/storage/dataGrid/components/DataGridNumericCell/DataGridNumericCell.tsx:95` | `focus-within:shadow-[inset_0_0_0_1.5px_rgba(0,82,205,1)]` | effects | TP |
| 9 | `src/pages/signup.tsx:58` | `to-[#FF02F5]` | color | TP |
| 10 | `src/features/orgs/projects/storage/components/StorageSidebar/StorageSidebar.tsx:159` | `leading-[1.66]` | typography | TP |
| 11 | `src/components/form/FormTextarea/FormTextarea.tsx:129` | `px-[1px]` | spacing | TP |
| 12 | `src/features/auth/SignIn/SignInWithEmailAndPassword/components/MfaSignInOtpForm.tsx:15` | `text-[1.25rem]` | typography | TP |
| 13 | `src/features/orgs/projects/storage/dataGrid/components/DataGridBody/DataGridBody.tsx:154` | `hover:bg-[color-mix(in_srgb,hsl(var(--muted))_60%,hsl(var(--background)))]` | effects | TP |
| 14 | `src/features/orgs/projects/logs/components/LogsBody/columns.tsx:32` | `text-[0.75rem]` | typography | TP |
| 15 | `src/pages/orgs/[orgSlug]/projects/[appSubdomain]/storage/buckets/[...bucketId].tsx:11` | `xs+:pb-[56.5px]` | spacing | TP |
| 16 | `src/components/layout/NavigationList/NavigationList.tsx:101` | `transition-[color,background-color,padding]` | motion | TP |
| 17 | `src/components/layout/Header/SheetListSection.tsx:14` | `tracking-[0.16em]` | typography | TP |
| 18 | `src/features/orgs/components/members/components/OrgMember/OrgMember.tsx:180` | `text-[10px]` | typography | TP |
| 19 | `src/features/orgs/projects/remote-schemas/components/RemoteSchemaBrowserSidebar/RemoteSchemaBrowserSidebar.tsx:193` | `px-[0.625rem]` | spacing | TP |
| 20 | `src/features/orgs/projects/database/dataGrid/components/ViewDefinitionView/ViewDefinitionView.tsx:53` | `leading-[1.66]` | typography | TP |
| 21 | `src/features/orgs/projects/database/dataGrid/components/EditFunctionGraphQLSettingsForm/EditFunctionGraphQLSettingsForm.tsx:197` | `leading-[1.66]` | typography | TP |
| 22 | `src/features/orgs/projects/database/schema-diagram/SchemaDiagram.tsx:441` | `transition-[opacity,box-shadow]` | motion | TP |
| 23 | `src/features/orgs/projects/events/event-triggers/components/EventTriggerView/EventTriggerView.tsx:93` | `py-[0.2rem]` | spacing | TP |
| 24 | `src/features/orgs/projects/database/dataGrid/components/EditFunctionForm/EditFunctionForm.tsx:43` | `text-[12px]` | typography | TP |
| 25 | `src/features/orgs/projects/storage/dataGrid/components/DataGridTextCell/DataGridTextCell.tsx:146` | `focus-within:shadow-[inset_0_0_0_1.5px_rgba(0,82,205,1)]` | effects | TP |
| 26 | `src/features/orgs/projects/logs/components/LogsBody/LogsTable.tsx:253` | `leading-[0.875rem]` | typography | TP |
| 27 | `src/features/orgs/projects/graphql/actions/components/ActionsBrowserSidebar/ActionsBrowserSidebar.tsx:86` | `px-[0.625rem]` | spacing | TP |
| 28 | `src/features/orgs/projects/events/common/components/PayloadTransformFormSection/TransformedRequestBody.tsx:101` | `rounded-[5px]` | shape | TP |
| 29 | `src/features/orgs/components/InfoAlert/InfoAlert.tsx:23` | `text-[0.875rem]` | typography | TP |
| 30 | `src/features/orgs/projects/logs/components/LogsBody/LogsTable.tsx:253` | `text-[0.75rem]` | typography | TP |

Result: **30 appearance findings** (typography 15, spacing 6, effects 4, color 2, motion 2, shape 1); **0 passing layout values among reported findings**, **0/30 false positives**. Passing layout examples `w-[320px]`, `[mask-type:alpha]` and arbitrary variants are checked by the fixtures. Color functions using a CSS variable as their entire paint value, such as `ring-[rgb(var(--schema-color))]`, also pass; hardcoded multi-part shadow dimensions remain reported.
