import { describe, expect, it } from 'vitest'
import { appendImageTransformationParameters, StorageImageTransformationParams } from '../src/utils'

describe('appendImageTransformationParameters', () => {
  it('appends image transformation parameters to the url', () => {
    const url = 'https://example.com/image.jpg'
    const params: StorageImageTransformationParams = {
      width: 200,
      height: 300,
      quality: 80,
      blur: 10
    }
    const result = appendImageTransformationParameters(url, params)
    expect(result).toBe('https://example.com/image.jpg?w=200&h=300&q=80&b=10')
  })

  it('returns the original url when no parameters are provided', () => {
    const url = 'https://example.com/image.jpg'
    const params: StorageImageTransformationParams = {}
    const result = appendImageTransformationParameters(url, params)
    expect(result).toBe('https://example.com/image.jpg')
  })
})
