import type {
  HasuraOperator,
  Rule,
  RuleGroup,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/**
 * Converts a Hasura operator from dashboard's internal logic to a Hasura's
 * valid operator.
 * (Without _in_hasura and _nin_hasura)
 *
 * @param operator - The Hasura operator to convert
 * @returns - A string representation of the Hasura operator
 */
function convertOperator(operator: HasuraOperator): string {
  switch (operator) {
    case '_in_hasura':
      return '_in';
    case '_nin_hasura':
      return '_nin';
    default:
      return operator;
  }
}

function createNestedObjectFromRule({
  column,
  operator,
  value,
}: Rule): Record<string, any> {
  const columnNameParts = column.split('.');

  const cleanedOperator = convertOperator(operator);

  if (columnNameParts.length === 1 && cleanedOperator === '_is_null') {
    return {
      [column]: {
        [cleanedOperator]: value === 'true',
      },
    };
  }

  if (columnNameParts.length === 1) {
    return {
      [column]: {
        [cleanedOperator]: value,
      },
    };
  }

  return {
    [columnNameParts[0]]: {
      ...createNestedObjectFromRule({
        column: columnNameParts.slice(1).join('.'),
        operator: cleanedOperator as HasuraOperator,
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
