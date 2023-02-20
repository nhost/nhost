import { describe, expect, it } from 'vitest'
import { toIso88591 } from '../src/utils/upload'

describe('test file names', () => {
  it('should be able to use ISO 8859-1 strings', async () => {
    expect(toIso88591('a 你 好')).toMatchInlineSnapshot('"a%20%E4%BD%A0%20%E5%A5%BD"')
    expect(toIso88591('abcÂÃ')).toMatchInlineSnapshot('"abcÂÃ"')
    expect(toIso88591('你 好')).toMatchInlineSnapshot('"%E4%BD%A0%20%E5%A5%BD"')
    expect(toIso88591('abc')).toMatchInlineSnapshot('"abc"')
    expect(toIso88591('╗')).toMatchInlineSnapshot('"%E2%95%97"')
    expect(toIso88591("Capture d'écran 2022-06-23 à 16.45.06.png")).toMatchInlineSnapshot('"Capture d\'écran 2022-06-23 à 16.45.06.png"')
  })
})
