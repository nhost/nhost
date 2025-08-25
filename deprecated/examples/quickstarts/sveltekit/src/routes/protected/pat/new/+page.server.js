import { getNhost } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async ({ request, cookies }) => {
    const nhost = await getNhost(cookies)

    const formData = await request.formData()

    const name = String(formData.get('name'))
    const expiration = String(formData.get('expiration'))
    const expirationDate = new Date(expiration)

    await nhost.auth.createPAT(expirationDate, { name })

    throw redirect(303, '/protected/pat')
  }
}
