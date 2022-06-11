import { ref } from 'vue'
import { nestedUnref } from '../src/helpers'
describe('nestedUnref', () => {
  it('should unref ref values in a unref property', async () => {
    const a = ref('value of a')
    const b = ref('value of b')
    const input = { metadata: { a, b } }
    const result = nestedUnref(input)

    expect(result).toEqual({ metadata: { a: a.value, b: b.value } })
  })

  it('should unref a property', async () => {
    const metadataValue = { firstName: 'John', lastName: 'Doe' }
    const input = { metadata: ref(metadataValue) }
    const result = nestedUnref(input)

    expect(result).toEqual({ metadata: metadataValue })
  })
})
