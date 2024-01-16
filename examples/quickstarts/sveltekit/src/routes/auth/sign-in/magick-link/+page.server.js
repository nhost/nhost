import { getNhost } from '$lib/nhost'

/** @type {import('./$types').Actions} */
export const actions = {
  default: async (event) => {
    const { request, cookies } = event

    const formData = await request.formData()
    const nhost = await getNhost(cookies)

    const email = String(formData.get('email'))

    const { error } = await nhost.auth.signIn({ email })

    if (error) {
      return { error }
    } else {
      return {
        isSuccess: true
      }
    }
  }
}
