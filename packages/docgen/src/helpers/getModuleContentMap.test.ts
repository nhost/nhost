import getModuleContentMap from './getModuleContentMap'

test('should categorize elements of groups in a Map', () => {
  expect(
    getModuleContentMap([
      { title: 'Classes', kind: 0, children: [1, 2, 3] },
      { title: 'Properties', kind: 0, children: [4, 5, 6, 7] },
      { title: 'Type aliases', kind: 0, children: [8, 9] },
      { title: 'Functions', kind: 0, children: [10] }
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
      [10, 'Function']
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
