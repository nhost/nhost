import { expect, test } from 'vitest'

import getModuleContentMap from './getModuleContentMap'

test('should categorize elements of groups in a Map', () => {
  expect(
    getModuleContentMap([
      { title: 'Classes', kind: 0, children: [1, 2, 3] },
      { title: 'Properties', kind: 0, children: [4, 5, 6, 7] },
      { title: 'Type aliases', kind: 0, children: [8, 9] },
      { title: 'Functions', kind: 0, children: [10] },
      { title: 'Components', kind: 0, children: [11, 12, 13] },
      { title: 'References', kind: 0, children: [14, 15] }
    ])
  ).toEqual(
    new Map([
      [1, 'Class'],
      [2, 'Class'],
      [3, 'Class'],
      [4, 'Property'],
      [5, 'Property'],
      [6, 'Property'],
      [7, 'Property'],
      [8, 'Type alias'],
      [9, 'Type alias'],
      [10, 'Function'],
      [11, 'Component'],
      [12, 'Component'],
      [13, 'Component'],
      [14, 'Reference'],
      [15, 'Reference']
    ])
  )
})

test('should extend original map if provided', () => {
  expect(
    getModuleContentMap(
      [{ title: 'Variables', kind: 0, children: [1, 2, 3] }],
      new Map([[0, 'Class']])
    )
  ).toEqual(
    new Map([
      [0, 'Class'],
      [1, 'Variable'],
      [2, 'Variable'],
      [3, 'Variable']
    ])
  )
})

test('should set content type to "undefined" if value does not exist in dictionary', () => {
  expect(
    getModuleContentMap([
      { title: 'Variables', kind: 0, children: [1, 2, 3] },
      { title: 'DefinitelySomethingThatDoesNotExist', kind: 0, children: [4] }
    ])
  ).toEqual(
    new Map([
      [1, 'Variable'],
      [2, 'Variable'],
      [3, 'Variable'],
      [4, 'undefined']
    ])
  )
})

test('should not treat the same text with different letter casing differently', () => {
  expect(
    getModuleContentMap([
      { title: 'Type aliases', kind: 0, children: [1, 2, 3] },
      { title: 'Type Aliases', kind: 0, children: [4] },
      { title: 'TYPE ALIASES', kind: 0, children: [5, 6] }
    ])
  ).toEqual(
    new Map([
      [1, 'Type alias'],
      [2, 'Type alias'],
      [3, 'Type alias'],
      [4, 'Type alias'],
      [5, 'Type alias'],
      [6, 'Type alias']
    ])
  )
})

test('should update the type of a child if it has a special category (not "Other")', () => {
  expect(
    getModuleContentMap([
      {
        title: 'Functions',
        kind: 0,
        children: [1, 2, 3],
        categories: [
          { title: 'Components', children: [3] },
          { title: 'Other', children: [1] }
        ]
      },
      { title: 'Type Aliases', kind: 0, children: [4] }
    ])
  ).toEqual(
    new Map([
      [1, 'Function'],
      [2, 'Function'],
      [3, 'Component'],
      [4, 'Type alias']
    ])
  )
})
