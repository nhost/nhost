import { describe, expect, it } from 'vitest';
import {
  commonOperators,
  getAvailableOperators,
  jsonbSpecificOperators,
  textSpecificOperators,
} from '@/features/orgs/projects/database/dataGrid/components/RuleGroupEditor/getAvailableOperators';

describe('getAvailableOperators', () => {
  it('should return only common operators when no column type is provided', () => {
    const result = getAvailableOperators();

    expect(result).toEqual(commonOperators);
  });

  it('should return only common operators for an unknown column type', () => {
    const result = getAvailableOperators('integer');

    expect(result).toEqual(commonOperators);
  });

  it('should return common + text operators for text column type', () => {
    const result = getAvailableOperators('text');

    expect(result).toEqual([...commonOperators, ...textSpecificOperators]);
  });

  it('should return common + jsonb operators for jsonb column type', () => {
    const result = getAvailableOperators('jsonb');

    expect(result).toEqual([...commonOperators, ...jsonbSpecificOperators]);
  });

  it('should not mutate the original operator arrays', () => {
    const commonBefore = [...commonOperators];
    const textBefore = [...textSpecificOperators];
    const jsonbBefore = [...jsonbSpecificOperators];

    getAvailableOperators('text');
    getAvailableOperators('jsonb');

    expect(commonOperators).toEqual(commonBefore);
    expect(textSpecificOperators).toEqual(textBefore);
    expect(jsonbSpecificOperators).toEqual(jsonbBefore);
  });
});
