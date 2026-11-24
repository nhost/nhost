Fixed seed `712`, Python `random.Random(712).sample(range(86), 30)` over the `no-inline-styles` findings in report file/source order. The 30 sampled findings were checked against their JSX `style` syntax. **False positives: 0/30.** Ordinary properties are strictly disallowed, including dynamically computed values and forwarded-table sizing; the audit does not classify unavoidable violations as false positives.

| Sample index (of 86) | Source location and subject | Verdict |
| ---: | --- | --- |
| 37 | `events/cron-triggers/…/CronTriggerInvocationLogsDataTable.tsx:67` `width` | ordinary property |
| 79 | `storage/dataGrid/…/DataGridCell.tsx:328` `right` | ordinary property |
| 63 | `logs/…/LogsTable.tsx:207` `height` | ordinary property |
| 62 | `logs/…/LogsTable.tsx:185` `stickyLeft!==null?{left:stickyLeft}:undefined` | unreadable conditional (`dynamicStyle`) |
| 10 | `command-palette/…/CommandPalette.tsx:451` `height` | ordinary property |
| 54 | `logs/…/LogsTable.tsx:157` `minWidth` | ordinary property |
| 25 | `database/dataGrid/…/SQLEditor.tsx:250` `height` | ordinary property |
| 7 | `common/VirtualizedCombobox/VirtualizedCombobox.tsx:150` `transform` | ordinary property |
| 85 | `utils/toast/triggerToast.tsx:13` `backgroundColor` | ordinary property |
| 56 | `logs/…/LogsTable.tsx:159` `borderCollapse` | ordinary property |
| 34 | `deployments/…/DeploymentDurationLabel.tsx:59` `fontVariantNumeric` | ordinary property |
| 71 | `resources/settings/…/ResourceBreakdownChart.tsx:117` `width` | ordinary property |
| 84 | `storage/dataGrid/…/DataGridHeader.tsx:58` `right` | ordinary property |
| 1 | `common/VirtualizedCombobox/VirtualizedCombobox.tsx:119` `width` | ordinary property |
| 17 | `common/metrics/…/MetricChart.tsx:307` `height` | ordinary property |
| 45 | `events/event-triggers/…/EventTriggerInvocationLogsDataTable.tsx:138` `width` | ordinary property |
| 59 | `logs/…/LogsTable.tsx:165` `width` | ordinary property |
| 3 | `common/VirtualizedCombobox/VirtualizedCombobox.tsx:129` `height` | ordinary property |
| 51 | `events/one-offs/…/OneOffInvocationLogsDataTable.tsx:103` `width` | ordinary property |
| 78 | `storage/dataGrid/…/DataGridCell.tsx:327` `width` | ordinary property |
| 46 | `events/event-triggers/…/EventTriggerInvocationLogsDataTable.tsx:171` `width` | ordinary property |
| 29 | `database/schema-diagram/PermissionDot.tsx:48` `height` | ordinary property |
| 61 | `logs/…/LogsTable.tsx:167` `width` | ordinary property |
| 33 | `deployments/…/DeploymentDurationLabel.tsx:37` `fontVariantNumeric` | ordinary property |
| 39 | `events/cron-triggers/…/CronTriggerInvocationLogsDataTable.tsx:103` `width` | ordinary property |
| 19 | `common/metrics/…/MetricChartTooltip.tsx:106` `backgroundColor` | ordinary property |
| 14 | `common/…/TextWithTooltip.tsx:80` `WebkitLineClamp` | ordinary property |
| 65 | `logs/…/LogsTable.tsx:249` `stickyLeft!==null?{left:stickyLeft}:undefined` | unreadable conditional (`dynamicStyle`) |
| 0 | `common/VirtualizedCombobox/VirtualizedCombobox.tsx:118` `height` | ordinary property |
| 50 | `events/one-offs/…/OneOffInvocationLogsDataTable.tsx:83` `width` | ordinary property |

Every `dynamicStyle` finding (3):

| Source | Subject | Why |
| --- | --- | --- |
| `src/features/orgs/projects/logs/components/LogsBody/LogsTable.tsx:185` | `stickyLeft!==null?{left:stickyLeft}:undefined` | conditional style expression |
| `src/features/orgs/projects/logs/components/LogsBody/LogsTable.tsx:249` | `stickyLeft!==null?{left:stickyLeft}:undefined` | conditional style expression |
| `src/features/orgs/projects/remote-schemas/components/RemoteSchemaPreview/RemoteSchemaTree.tsx:134` | `resolvedTheme==='dark'?{backgroundColor:'hsl(var(--background))',color:'hsl(var(--foreground))'}:undefined` | conditional style expression; formatter-added trailing comma normalized |

**`customPropColor`: none** in the dashboard scope. The three newly covered ordinary-property findings in JSX nested in object properties are:

| Source | Subject | Context |
| --- | --- | --- |
| `src/features/orgs/projects/database/dataGrid/components/CustomCheckEditor/OperatorComboBox.tsx:43` | `minWidth` | `render` JSX in the options map |
| `src/features/orgs/projects/serverless-functions/components/MetricsTab/sections/ErrorsSection.tsx:65` | `color` | `render` JSX in a column definition |
| `src/features/orgs/projects/storage/dataGrid/components/DataGrid/useDataGrid.tsx:124` | `cursor` | `header` JSX in a column definition |

The only `<style>` site is `src/components/ui/v3/chart.tsx`, which is exempted by the shared manifest scope, and the fixture verifies that in-scope `<style>` is reported. No application code was changed.
