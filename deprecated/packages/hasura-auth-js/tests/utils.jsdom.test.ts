/**
 * @vitest-environment jsdom
 */

import { expect, test, suite, assert, vi } from 'vitest'
import { removeParameterFromWindow } from '../src'

suite('removeParameterFromWindow', () => {
  test('removes the specified parameter from the URL', () => {
    // Create a mock window object and assign it to the global window variable
    window = {
      location: {
        pathname: '/path/to/page',
        search: '?param1=value1&param2=value2',
        hash: '#hashparam1=hashvalue1&hashparam2=hashvalue2'
      },
      history: {
        pushState: vi.fn() // Create a mock function for the pushState method
      }
    }

    removeParameterFromWindow('param1')
    expect(window.history.pushState).toHaveBeenCalledWith(
      {},
      '',
      '/path/to/page?param2=value2#hashparam1=hashvalue1&hashparam2=hashvalue2'
    )
  })

  test('removes the specified parameter from the hash', () => {
    // Create a mock window object and assign it to the global window variable
    window = {
      location: {
        pathname: '/path/to/page',
        search: '?param1=value1&param2=value2',
        hash: '#hashparam1=hashvalue1&hashparam2=hashvalue2'
      },
      history: {
        pushState: vi.fn() // Create a mock function for the pushState method
      }
    }

    removeParameterFromWindow('hashparam1')
    expect(window.history.pushState).toHaveBeenCalledWith(
      {},
      '',
      '/path/to/page?param1=value1&param2=value2#hashparam2=hashvalue2'
    )
  })

  test('does nothing if the location property of the window object is not defined', () => {
    // Create a mock window object with an undefined location property and assign it to the global window variable
    window = {
      location: undefined,
      history: {
        pushState: vi.fn() // Create a mock function for the pushState method
      }
    }

    // No assertion is necessary since the function should not do anything if the location property is not defined
    removeParameterFromWindow('param1')
    expect(window.history.pushState).toHaveBeenCalledTimes(0)
  })
})
