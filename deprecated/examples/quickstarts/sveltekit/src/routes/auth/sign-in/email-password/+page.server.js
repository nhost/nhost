import { getNhost, NHOST_SESSION_KEY } from '$lib/nhost'
import { redirect } from '@sveltejs/kit'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async (event) => {
    const { request, cookies } = event

    const formData = await request.formData()
    const nhost = await getNhost(cookies)

    const email = String(formData.get('email'))
    const password = String(formData.get('password'))

    const { session, error } = await nhost.auth.signIn({ email, password })

    if (session) {
      cookies.set(NHOST_SESSION_KEY, btoa(JSON.stringify(session)), { path: '/' })
      throw redirect(303, '/protected/todos')
    }

    if (error) {
      return {
        error: error?.message
      }
    }
  }
}
