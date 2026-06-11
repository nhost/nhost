import { parseType } from 'graphql';
import { describe, expect, it } from 'vitest';
import {
  getAstTypeMetadata,
  unwrapType,
  wrapTypename,
} from './graphqlTypeUtils';

describe('unwrapType', () => {
  it('unwraps a plain type', () => {
    expect(unwrapType('SampleInput')).toEqual({
      typename: 'SampleInput',
      stack: [],
    });
  });

  it('unwraps a non-nullable list of non-nullable types', () => {
    expect(unwrapType('[SampleInput!]!')).toEqual({
      typename: 'SampleInput',
      stack: ['n', 'l', 'n'],
    });
  });

  it('unwraps a nested list', () => {
    expect(unwrapType('[[SampleInput]]')).toEqual({
      typename: 'SampleInput',
      stack: ['l', 'l'],
    });
  });
});

describe('wrapTypename', () => {
  it('returns the typename when the stack is empty', () => {
    expect(wrapTypename('SampleInput', [])).toBe('SampleInput');
  });

  it('wraps the typename in reverse stack order', () => {
    expect(wrapTypename('SampleInput', ['n', 'l', 'n'])).toBe(
      '[SampleInput!]!',
    );
  });

  it('round-trips with unwrapType', () => {
    const wrapped = '[[SampleInput!]]!';
    const { typename, stack } = unwrapType(wrapped);
    expect(wrapTypename(typename, stack)).toBe(wrapped);
  });
});

describe('getAstTypeMetadata', () => {
  it('extracts the typename and wrapper stack from an AST type node', () => {
    const metadata = getAstTypeMetadata(parseType('[SampleInput!]!'));
    expect(metadata).toEqual({
      typename: 'SampleInput',
      stack: ['n', 'l', 'n'],
    });
    expect(wrapTypename(metadata.typename, metadata.stack)).toBe(
      '[SampleInput!]!',
    );
  });
});
