import { ref } from 'vue'
import { nestedUnref } from '../src/helpers'
describe('nestedUnref', () => {
  it('shoud unref ref values in a unref property', async () => {
    const a = ref('value of a')
    const b = ref('value of b')
    const input = { metadata: { a, b } }
    const result = nestedUnref(input)

    expect(result).toEqual({ metadata: { a: a.value, b: b.value } })
  })
})
