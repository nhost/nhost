import mockClass from '../__mocks__/mockClass'
import ClassTemplate from './ClassTemplate'

const classSignatureBase = {
  ...mockClass,
  name: 'TestClass'
}

test('should contain title and a placeholder description in front matter', () => {
  expect(
    ClassTemplate({
      ...classSignatureBase,
      comment: {
        shortText: ''
      }
    })
  ).toContain(`---
title: TestClass
description: No description provided.
---`)
})

test('should contain description in front matter', () => {
  expect(
    ClassTemplate({
      ...classSignatureBase,
      comment: {
        shortText: 'Test Description'
      }
    })
  ).toContain(`---
title: TestClass
description: Test Description
---`)
})

test('should contain name of the class as heading wrapped in backticks', () => {
  expect(ClassTemplate(classSignatureBase)).toContain(`# \`TestClass\``)
})

test('should contain title and description of the class', () => {
  expect(
    ClassTemplate({
      ...classSignatureBase,
      comment: {
        shortText: 'Test Description'
      }
    })
  ).toContain(`
# \`TestClass\`

Test Description
`)
})

test('should contain a deprecation note if the class is deprecated', () => {
  expect(
    ClassTemplate({
      ...classSignatureBase,
      comment: {
        tags: [{ tag: 'deprecated', text: '' }]
      }
    })
  ).toContain(`
:::caution Deprecated
This class is deprecated.
:::
`)

  expect(
    ClassTemplate({
      ...classSignatureBase,
      comment: {
        tags: [{ tag: 'deprecated', text: 'This is a sample deprecation note.' }]
      }
    })
  ).toContain(`
:::caution Deprecated
This is a sample deprecation note.
:::
`)
})

test('should contain parameters', () => {
  expect(ClassTemplate(classSignatureBase)).toContain(`
## Parameters

---

**options** <span className="optional-status">required</span> [\`NhostClientOptions\`](/types/nhost-client-options)

Sample Description

---`)
})
