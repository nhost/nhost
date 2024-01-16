import { getNhost } from '$lib/nhost'

/** @type {import('./$types').PageServerLoad} */
export const load = async ({ cookies }) => {
  const nhost = await getNhost(cookies)

  const { res } = await nhost.functions.call('echo')

  return {
    res
  }
}
