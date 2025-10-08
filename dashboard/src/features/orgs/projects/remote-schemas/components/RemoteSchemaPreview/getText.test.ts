import React from 'react';
import { describe, expect, it } from 'vitest';
import getText from './getText';

function Icon() {
  return React.createElement('svg');
}

describe('getText', () => {
  it('returns the same string for plain string inputs (e.g., root labels)', () => {
    expect(getText('Schema')).toBe('Schema');
    expect(getText('Query')).toBe('Query');
  });

  it('converts numbers to strings', () => {
    expect(getText(123)).toBe('123');
  });

  it('handles argument-like input with type annotation', () => {
    expect(getText('amount: Int!')).toBe('amount: Int!');
  });

  it('returns empty string for a React element with no children', () => {
    const element = React.createElement('span', null);
    expect(getText(element)).toBe('');
  });

  it('flattens array children like the field item structure in the tree (icon + span text)', () => {
    const fieldElement = React.createElement(
      'div',
      { className: 'flex items-center gap-1', style: { color: '#6b7280' } },
      [
        React.createElement(Icon, { key: 'icon', className: 'text-gray-400' }),
        React.createElement('span', { key: 'text' }, 'Slug: String!'),
      ],
    );
    expect(getText(fieldElement)).toBe('Slug: String!');
  });
});
