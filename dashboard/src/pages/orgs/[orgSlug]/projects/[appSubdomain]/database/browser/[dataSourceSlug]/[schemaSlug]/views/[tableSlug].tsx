// Views and materialized views reuse the same page component as tables.
// so the URL segment ("tables" vs "views") is purely cosmetic.
export { default } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]/[schemaSlug]/tables/[tableSlug]';
