import hoc from '@nhost/nextjs'

export const withNhost = hoc({
  backendUrl: 'http://127.0.0.1:1337'
})
