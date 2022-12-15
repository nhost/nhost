import type { Rule, RuleGroup } from '@/types/dataBrowser';

function createNestedObjectFromRule({ column, operator, value }: Rule) {
  const columnNameParts = column.split('.');

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

export default function convertToHasuraPermissions(ruleGroup: RuleGroup) {
  if (ruleGroup.rules.length === 1 && ruleGroup.groups.length === 0) {
    return createNestedObjectFromRule(ruleGroup.rules[0]);
  }

  if (ruleGroup.rules.length > 0 && ruleGroup.groups.length === 0) {
    return {
      [ruleGroup.operator]: ruleGroup.rules.map((rule) =>
        createNestedObjectFromRule(rule),
      ),
    };
  }

  return {};
}
