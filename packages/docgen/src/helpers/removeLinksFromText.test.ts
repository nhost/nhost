import { expect, test } from 'vitest'

import removeLinksFromText from './removeLinksFromText'

test('should return an empty string if text is undefined', () => {
  expect(removeLinksFromText()).toBe('')
  expect(removeLinksFromText(undefined)).toBe('')
})

test('comment should contain only the text of a TSDoc link', () => {
  expect(removeLinksFromText(`This comment has links to {@link removeLinksFromText}.`)).toBe(
    `This comment has links to removeLinksFromText.`
  )

  expect(removeLinksFromText(`{@link https://custom-url.example.com?query=test+text#L62}`)).toBe(
    `https://custom-url.example.com?query=test+text#L62`
  )
})

test('comment should contain only the texts of TSDoc links', () => {
  expect(
    removeLinksFromText(
      `This comment has links to {@link removeLinksFromText} and some other {@link customFunction}.`
    )
  ).toBe(`This comment has links to removeLinksFromText and some other customFunction.`)
})
