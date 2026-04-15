import type { DataGridFilter } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import type { HasuraOperator } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { Files_Bool_Exp } from '@/utils/__generated__/graphql';

const operatorMap: Record<string, HasuraOperator> = {
  '=': '_eq',
  '<>': '_neq',
  '>': '_gt',
  '<': '_lt',
  '>=': '_gte',
  '<=': '_lte',
  LIKE: '_like',
  'NOT LIKE': '_nlike',
  ILIKE: '_ilike',
  'NOT ILIKE': '_nilike',
  'SIMILAR TO': '_similar',
  'NOT SIMILAR TO': '_nsimilar',
  '~': '_regex',
  '!~': '_nregex',
  '~*': '_iregex',
  '!~*': '_niregex',
  IN: '_in',
  'NOT IN': '_nin',
  IS: '_is_null',
  'IS NOT': '_is_null',
};

function buildComparisonExp(
  op: string,
  value: string,
): Record<string, unknown> {
  const hasuraOp = operatorMap[op];
  if (!hasuraOp) {
    return {};
  }

  if (op === 'IS') {
    return { _is_null: true };
  }
  if (op === 'IS NOT') {
    return { _is_null: false };
  }
  if (op === 'IN' || op === 'NOT IN') {
    return { [hasuraOp]: value.split(',').map((v) => v.trim()) };
  }

  return { [hasuraOp]: value };
}

export function filtersToFilesWhere(
  filters: DataGridFilter[],
  bucketId: string,
): Files_Bool_Exp {
  const bucketFilter: Files_Bool_Exp = { bucketId: { _eq: bucketId } };

  if (filters.length === 0) {
    return bucketFilter;
  }

  const filterConditions: Files_Bool_Exp[] = filters.map((filter) => ({
    [filter.column]: buildComparisonExp(filter.op, filter.value),
  }));

  return { _and: [bucketFilter, ...filterConditions] };
}
