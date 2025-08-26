import { expect, test } from 'vitest'

import DeprecationNoteFragment from './DeprecationNoteFragment'

test('should contain default message in a deprecation note if tag does not have any text', () => {
  expect(DeprecationNoteFragment({ tag: 'deprecated', text: '' })).toContain(`:::caution Deprecated
No description provided.
:::`)
})

test('should remove leading or trailing new lines', () => {
  expect(DeprecationNoteFragment({ tag: 'deprecated', text: 'Test\n' }))
    .toContain(`:::caution Deprecated
Test
:::`)
})
