import { describe, expect, test } from 'vitest';
import buildFunctionSignature from './buildFunctionSignature';

describe('buildFunctionSignature', () => {
  test('should return schema-qualified name with no parameters', () => {
    expect(buildFunctionSignature('public', 'my_func', [])).toBe(
      'public.my_func',
    );
  });

  test('should include a single parameter type', () => {
    expect(
      buildFunctionSignature('public', 'my_func', [
        { name: 'id', type: 'int4', displayType: 'integer', schema: null },
      ]),
    ).toBe('public.my_func(int4)');
  });

  test('should include multiple parameter types', () => {
    expect(
      buildFunctionSignature('public', 'my_func', [
        { name: 'id', type: 'int4', displayType: 'integer', schema: null },
        {
          name: 'name',
          type: 'text',
          displayType: 'text',
          schema: null,
        },
      ]),
    ).toBe('public.my_func(int4, text)');
  });

  test('should schema-qualify parameter types when schema is present', () => {
    expect(
      buildFunctionSignature('public', 'my_func', [
        {
          name: 'input',
          type: 'my_type',
          displayType: 'my_type',
          schema: 'custom',
        },
      ]),
    ).toBe('public.my_func(custom.my_type)');
  });

  test('should handle mixed schema-qualified and unqualified parameters', () => {
    expect(
      buildFunctionSignature('analytics', 'process', [
        { name: 'id', type: 'int4', displayType: 'integer', schema: null },
        {
          name: 'data',
          type: 'json_input',
          displayType: 'json_input',
          schema: 'types',
        },
        { name: 'flag', type: 'bool', displayType: 'boolean', schema: null },
      ]),
    ).toBe('analytics.process(int4, types.json_input, bool)');
  });

  test('should escape double quotes in identifiers', () => {
    expect(
      buildFunctionSignature('my"schema', 'my"func', [
        {
          name: 'input',
          type: 'my"type',
          displayType: 'my"type',
          schema: 'my"schema',
        },
      ]),
    ).toBe('"my""schema"."my""func"("my""schema"."my""type")');
  });
});
