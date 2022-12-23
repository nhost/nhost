import type { HasuraOperator, RuleGroup } from '@/types/dataBrowser';

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
  _in_hasura: '_nin_hasura',
  _nin_hasura: '_in_hasura',
};

export default function convertToRuleGroup(
  hasuraPermissions: Record<string, any>,
  previousKey?: string,
  shouldNegate?: boolean,
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
  const value = hasuraPermissions[currentKey];

  if (currentKey === '_not') {
    return convertToRuleGroup(hasuraPermissions[currentKey], previousKey, true);
  }

  if (currentKey === '_exists') {
    return { _exists: hasuraPermissions[currentKey] } as any;
  }

  if (
    (currentKey === '_in' || currentKey === '_nin') &&
    typeof value === 'string'
  ) {
    const operator = currentKey === '_in' ? '_in_hasura' : '_nin_hasura';

    return {
      operator: '_and',
      rules: [
        {
          column: previousKey,
          operator: shouldNegate
            ? negatedValueOperatorPairs[operator]
            : operator,
          value,
        },
      ],
      groups: [],
    };
  }

  if (currentKey === '_is_null' && typeof value === 'boolean') {
    const negatedValue = !value;

    return {
      operator: '_and',
      rules: [
        {
          column: previousKey,
          operator: '_is_null',
          value: shouldNegate ? negatedValue : value,
        },
      ],
      groups: [],
    };
  }

  if (currentKey === '_is_null' && typeof value !== 'boolean') {
    const negatedValue = value === 'true' ? 'false' : 'true';

    return {
      operator: '_and',
      rules: [
        {
          column: previousKey,
          operator: '_is_null',
          value: shouldNegate ? negatedValue : value,
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
          value: hasuraPermissions[currentKey],
        },
      ],
      groups: [],
    };
  }

  if (currentKey === '_or' || currentKey === '_and') {
    return hasuraPermissions[currentKey]
      .map((permissionObject: ArrayLike<string> | Record<string, any>) =>
        convertToRuleGroup(permissionObject, previousKey, shouldNegate),
      )
      .reduce(
        (accumulator: RuleGroup, rule: RuleGroup) => {
          if (!('rules' in rule) && !('groups' in rule)) {
            return {
              ...accumulator,
              unsupported: [rule],
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
          };
        },
        {
          operator: shouldNegate
            ? negatedArrayOperatorPairs[currentKey]
            : currentKey,
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
    shouldNegate,
  );
}
