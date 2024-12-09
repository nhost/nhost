import type {
  HasuraOperator,
  RuleGroup,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

function createNestedObject(pathParts: string[], value: any) {
  const [currentPath, ...restPath] = pathParts;

  if (pathParts.length === 0) {
    return value;
  }

  if (pathParts.length === 1) {
    return {
      [currentPath]: value,
    };
  }

  return {
    [currentPath]: createNestedObject(restPath, value),
  };
}

const negatedArrayOperatorPairs: Record<'_and' | '_or', '_and' | '_or'> = {
  _and: '_or',
  _or: '_and',
};

const negatedValueOperatorPairs: Record<HasuraOperator, HasuraOperator> = {
  _eq: '_neq',
  _neq: '_eq',
  _in: '_nin',
  _nin: '_in',
  _gt: '_lte',
  _lt: '_gte',
  _gte: '_lt',
  _lte: '_gt',
  _like: '_nlike',
  _nlike: '_like',
  _ilike: '_nilike',
  _nilike: '_ilike',
  _similar: '_nsimilar',
  _nsimilar: '_similar',
  _regex: '_nregex',
  _nregex: '_regex',
  _iregex: '_niregex',
  _niregex: '_iregex',
  _ceq: '_cne',
  _cne: '_ceq',
  _cgt: '_clte',
  _clt: '_cgte',
  _cgte: '_clt',
  _clte: '_cgt',
  _is_null: '_is_null',
};

export default function convertToRuleGroup(
  hasuraPermissions: Record<string, any>,
  options?: {
    previousKey?: string;
    shouldNegate?: boolean;
    isNested?: boolean;
  },
): RuleGroup {
  const { previousKey, shouldNegate = false, isNested = false } = options || {};

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

  // Note: Exists is currently not supported by the UI, so we are returning it
  // as is and treating it as an unsupported object type.
  if (currentKey === '_exists') {
    const pathParts = previousKey?.split('.') || [];

    if (!isNested) {
      return {
        operator: '_and',
        rules: [],
        groups: [],
        unsupported: [
          createNestedObject(pathParts, {
            _exists: value,
          }),
        ],
      };
    }

    return createNestedObject(pathParts, {
      _exists: value,
    });
  }

  // Note: _not is a special case, we just need to negate the nested operators
  // or values in certain cases (e.g: _is_null).
  if (currentKey === '_not') {
    return convertToRuleGroup(value, {
      ...options,
      shouldNegate: true,
    });
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
            column: previousKey,
            operator: '_is_null',
            value: Boolean(
              shouldNegate ? !convertedValue : convertedValue,
            ).toString(),
          },
        ],
        groups: [],
      };
    }

    return {
      operator: '_and',
      rules: [
        {
          column: options.previousKey,
          operator: '_is_null',
          value: Boolean(shouldNegate ? !value : value).toString(),
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
          column: previousKey,
          operator: shouldNegate
            ? negatedValueOperatorPairs[currentKey]
            : currentKey,
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
    ].includes(currentKey)
  ) {
    return {
      operator: '_and',
      rules: [
        {
          column: previousKey,
          operator: shouldNegate
            ? negatedValueOperatorPairs[currentKey]
            : currentKey,
          value,
        },
      ],
      groups: [],
    };
  }

  if (currentKey === '_or' || currentKey === '_and') {
    return value
      .map((permissionObject: ArrayLike<string> | Record<string, any>) =>
        convertToRuleGroup(permissionObject, {
          ...options,
          isNested: true,
        }),
      )
      .reduce(
        (accumulator: RuleGroup, rule: RuleGroup) => {
          if (!('rules' in rule) && !('groups' in rule)) {
            return {
              ...accumulator,
              unsupported: [...(accumulator.unsupported || []), rule],
            };
          }

          if (rule.rules.length > 1) {
            return {
              ...accumulator,
              groups: [...(accumulator.groups || []), rule],
            };
          }

          return {
            ...accumulator,
            rules: [...(accumulator.rules || []), ...rule.rules],
            unsupported: [
              ...(accumulator.unsupported || []),
              ...(rule.unsupported || []),
            ],
          };
        },
        {
          operator: shouldNegate
            ? negatedArrayOperatorPairs[currentKey]
            : currentKey,
          rules: [...(value?.rules || [])],
          groups: [...(value?.groups || [])],
        },
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
