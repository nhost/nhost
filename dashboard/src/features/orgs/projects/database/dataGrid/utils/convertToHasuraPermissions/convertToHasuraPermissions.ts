import type {
  HasuraOperator,
  Rule,
  RuleGroup,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isNotEmptyValue } from '@/lib/utils';

function createNestedObjectFromRule({
  column,
  operator,
  value,
}: Rule): Record<string, any> {
  const columnNameParts = column.split('.');

  if (columnNameParts.length === 1 && operator === '_is_null') {
    return {
      [column]: {
        [operator]: value === 'true',
      },
    };
  }

  if (columnNameParts.length === 1) {
    return {
      [column]: {
        [operator]: value,
      },
    };
  }

  return {
    [columnNameParts[0]]: {
      ...createNestedObjectFromRule({
        column: columnNameParts.slice(1).join('.'),
        operator,
        value,
      }),
    },
  };
}

/**
 * Converts a RuleGroup to a Hasura permission object.
 *
 * @param ruleGroup - The RuleGroup to convert
 * @returns - A Hasura permission object
 */
export default function convertToHasuraPermissions(
  ruleGroup?: Partial<RuleGroup> | null,
): Record<HasuraOperator, any> | null {
  if (!ruleGroup) {
    return null;
  }

  if (
    (!('rules' in ruleGroup) &&
      !('groups' in ruleGroup) &&
      !('unsupported' in ruleGroup)) ||
    (!ruleGroup.rules?.length &&
      !ruleGroup.groups?.length &&
      !ruleGroup.unsupported?.length)
  ) {
    return {} as Record<HasuraOperator, any>;
  }

  if (
    ruleGroup.rules?.length === 1 &&
    !ruleGroup.groups?.length &&
    !ruleGroup?.unsupported?.length
  ) {
    return createNestedObjectFromRule(ruleGroup.rules[0]);
  }

  if (
    !ruleGroup.rules?.length &&
    ruleGroup.groups?.length === 1 &&
    !ruleGroup.unsupported?.length
  ) {
    return convertToHasuraPermissions(ruleGroup.groups[0]);
  }

  const convertedRules = ruleGroup.rules?.map(createNestedObjectFromRule) || [];
  const subGroupRules =
    ruleGroup.groups?.map(convertToHasuraPermissions).filter(isNotEmptyValue) ||
    [];
  const convertedUnsupportedRules = ruleGroup.unsupported || [];
  const allRules = [
    ...convertedRules,
    ...subGroupRules,
    ...convertedUnsupportedRules,
  ];
  const key = ruleGroup.operator as HasuraOperator;

  const hasuraPermission = {
    [key]: allRules,
  } as Record<HasuraOperator, any>;
  return hasuraPermission;
}
