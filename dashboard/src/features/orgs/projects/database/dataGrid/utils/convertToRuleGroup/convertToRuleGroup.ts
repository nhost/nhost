import type {
  HasuraOperator,
  RuleGroup,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

export default function convertToRuleGroup(
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  hasuraPermissions: Record<string, any>,
  options?: {
    previousKey?: string;
  },
): RuleGroup {
  const { previousKey } = options || {};

  const keys = Object.keys(hasuraPermissions);

  if (keys.length !== 1) {
    return {
      operator: '_and',
      rules: [],
      groups: [],
    };
  }

  const [currentKey] = keys;
  const value = hasuraPermissions[currentKey];

  // Note: Exists is currently not supported by the UI, so we return an empty group.
  if (currentKey === '_exists') {
    return {
      operator: '_and',
      rules: [],
      groups: [],
    };
  }

  if (currentKey === '_not') {
    const childGroup = convertToRuleGroup(value, options);

    if (childGroup.operator === '_and') {
      return {
        ...childGroup,
        operator: '_not',
      };
    }

    return {
      operator: '_not',
      rules: [],
      groups: [childGroup],
    };
  }

  // Note: _is_null is special, because we need to negate its value instead of
  // the operator.
  if (currentKey === '_is_null') {
    if (typeof value !== 'boolean') {
      const convertedValue = value === 'true';

      return {
        operator: '_and',
        rules: [
          {
            column: previousKey as string,
            operator: '_is_null',
            value: String(convertedValue),
          },
        ],
        groups: [],
      };
    }

    return {
      operator: '_and',
      rules: [
        {
          column: options?.previousKey as string,
          operator: '_is_null',
          value: String(value),
        },
      ],
      groups: [],
    };
  }

  // Note: _in and _nin are special if they contain a string, because we need
  // to treat them differently in the UI.
  if (
    (currentKey === '_in' || currentKey === '_nin') &&
    typeof value === 'string'
  ) {
    return {
      operator: '_and',
      rules: [
        {
          column: previousKey as string,
          operator: currentKey as HasuraOperator,
          value,
        },
      ],
      groups: [],
    };
  }

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
      '_contains',
      '_contained_in',
      '_has_key',
      '_has_keys_any',
      '_has_keys_all',
    ].includes(currentKey)
  ) {
    return {
      operator: '_and',
      rules: [
        {
          column: previousKey as string,
          operator: currentKey as HasuraOperator,
          value,
        },
      ],
      groups: [],
    };
  }

  if (currentKey === '_or' || currentKey === '_and') {
    return (
      value
        // biome-ignore lint/suspicious/noExplicitAny: TODO
        .map((permissionObject: ArrayLike<string> | Record<string, any>) =>
          convertToRuleGroup(permissionObject, {
            ...options,
          }),
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
            rules: [...(value?.rules || [])],
            groups: [...(value?.groups || [])],
          },
        )
    );
  }

  if (typeof value !== 'object') {
    return {
      operator: '_and',
      rules: [],
      groups: [],
    };
  }

  return convertToRuleGroup(value, {
    ...options,
    previousKey: previousKey ? `${previousKey}.${currentKey}` : currentKey,
  });
}
