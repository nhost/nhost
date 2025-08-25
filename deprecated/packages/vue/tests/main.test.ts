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

  it('should unref a property', () => {
    const metadataValue = { firstName: 'John', lastName: 'Doe' }
    const input = { metadata: ref(metadataValue) }
    const result = nestedUnref(input)
    expect(result).toEqual({ metadata: metadataValue })
  })

  it('should return the same value when not a ref', () => {
    const input = { metadata: { firstName: 'John', lastName: 'Doe' } }
    const result = nestedUnref(input)
    expect(result).toEqual(input)
  })
})
