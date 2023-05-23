import type {
  Rule,
  RuleGroup,
} from '@/features/database/dataGrid/types/dataBrowser';

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
  ruleGroup?: Partial<RuleGroup>,
): Record<string, any> {
  if (!ruleGroup) {
    return null;
  }

  if (
    (!('rules' in ruleGroup) &&
      !('groups' in ruleGroup) &&
      !('unsupported' in ruleGroup)) ||
    (!ruleGroup.rules.length &&
      !ruleGroup.groups?.length &&
      !ruleGroup.unsupported?.length)
  ) {
    return {};
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
  const subGroupRules = ruleGroup.groups?.map(convertToHasuraPermissions) || [];
  const convertedUnsupportedRules = ruleGroup.unsupported || [];

  return {
    [ruleGroup.operator]: [
      ...convertedRules,
      ...subGroupRules,
      ...convertedUnsupportedRules,
    ],
  };
}
