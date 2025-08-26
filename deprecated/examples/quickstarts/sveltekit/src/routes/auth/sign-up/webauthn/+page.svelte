<script>
  import { goto } from '$app/navigation'
  import { env } from '$env/dynamic/public'
  import Button from '$lib/components/Button.svelte'
  import { NHOST_SESSION_KEY } from '$lib/nhost'
  import { NhostClient } from '@nhost/nhost-js'
  import Cookies from 'js-cookie'

  /** @type {string} */
  let email

  /** @type {import('@nhost/nhost-js').AuthErrorPayload | null}*/
  let error

  const handleSubmit = async () => {
    const nhost = new NhostClient({
      subdomain: env.PUBLIC_NHOST_SUBDOMAIN,
      region: env.PUBLIC_NHOST_REGION
    })

    const { session, error: signInError } = await nhost.auth.signUp({ email, securityKey: true })

    if (session) {
      Cookies.set(NHOST_SESSION_KEY, btoa(JSON.stringify(session)), { path: '/' })
      goto('/protected/todos')
    } else {
      error = signInError
    }
  }
</script>

<svelte:head>
	<title>Sign Up</title>
</svelte:head>

<div class="max-w-xl mx-auto space-y-4">
  <h1 class="text-2xl font-semibold text-center">Sign up with a security key</h1>
  
  {#if error}
    <p class="mt-3 font-semibold text-center text-red-500">{error.message}</p>
  {/if}
  
  <form class="space-y-4" on:submit|preventDefault={handleSubmit}>
    <input
      bind:value={email}
      placeholder='email'
      class="block w-full p-3 border rounded-md border-slate-300 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
    />
  
    <Button class='w-full' type="submit">Sign Up</Button>
  </form>
</div>

