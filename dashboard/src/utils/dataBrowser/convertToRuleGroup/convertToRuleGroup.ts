import type { HasuraOperator, RuleGroup } from '@/types/dataBrowser';

export default function convertToRuleGroup(
  hasuraPermissions: Record<string, any>,
  previousKey?: string,
): RuleGroup {
  const keys = Object.keys(hasuraPermissions);

  if (keys.length !== 1) {
    return {
      operator: '_and',
      rules: [],
      groups: [],
    };
  }

  const [currentKey] = keys;

  if (
    [
      '_eq',
      '_neq',
      '_in',
      '_nin',
      '_gt',
      '_lt',
      '_gte',
      '_lte',
      '_like',
      '_nlike',
      '_ilike',
      '_nilike',
      '_similar',
      '_nsimilar',
      '_regex',
      '_nregex',
      '_iregex',
      '_niregex',
      '_ceq',
      '_cne',
      '_cgt',
      '_clt',
      '_cgte',
      '_clte',
      '_is_null',
    ].includes(currentKey)
  ) {
    return {
      operator: '_and',
      rules: [
        {
          column: previousKey,
          operator: currentKey as HasuraOperator,
          value: hasuraPermissions[currentKey],
        },
      ],
      groups: [],
    };
  }

  if (currentKey === '_or' || currentKey === '_and') {
    return hasuraPermissions[currentKey]
      .map((permissionObject: ArrayLike<string> | Record<string, any>) =>
        convertToRuleGroup(permissionObject, previousKey),
      )
      .reduce(
        (accumulator: RuleGroup, rule: RuleGroup) => {
          if (rule.rules.length > 1) {
            return {
              ...accumulator,
              groups: [...(accumulator.groups || []), rule],
            };
          }

          return {
            ...accumulator,
            rules: [...(accumulator.rules || []), ...rule.rules],
          };
        },
        {
          operator: currentKey,
          rules: [...(hasuraPermissions[currentKey]?.rules || [])],
          groups: [...(hasuraPermissions[currentKey]?.groups || [])],
        },
      );
  }

  if (typeof hasuraPermissions[currentKey] !== 'object') {
    return {
      operator: '_and',
      rules: [],
      groups: [],
    };
  }

  return convertToRuleGroup(
    hasuraPermissions[currentKey],
    previousKey ? `${previousKey}.${currentKey}` : currentKey,
  );
}
